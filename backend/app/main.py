from __future__ import annotations

import csv
import io
from datetime import UTC, datetime

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.database import Base, engine, get_db
from app.models import GameSession, Participant, SessionStatus
from app.schemas import (
    AdminEntriesResponse,
    AdminEntry,
    LeaderboardEntry,
    ParticipantCreate,
    ParticipantOut,
    PrizeIssuedUpdate,
    SessionBootstrap,
    SessionCompleteIn,
    SessionCompletionResult,
    SessionOut,
)

settings = get_settings()

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)


def leaderboard_query(limit: int):
    return (
        select(GameSession)
        .options(joinedload(GameSession.participant))
        .where(GameSession.status == SessionStatus.COMPLETED.value)
        .order_by(desc(GameSession.score), desc(GameSession.completed_at), desc(GameSession.id))
        .limit(limit)
    )


def build_leaderboard_entries(sessions: list[GameSession]) -> list[LeaderboardEntry]:
    items: list[LeaderboardEntry] = []
    for session in sessions:
        participant = session.participant
        items.append(
            LeaderboardEntry(
                session_id=session.id,
                full_name=f"{participant.first_name} {participant.last_name[:1]}.",
                score=session.score,
                won=session.won,
                protection_level=session.protection_level,
                completed_at=session.completed_at,
            )
        )
    return items


@app.get("/api/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/participants", response_model=SessionBootstrap)
def create_participant(payload: ParticipantCreate, db: Session = Depends(get_db)) -> SessionBootstrap:
    participant = Participant(
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        telegram=payload.telegram,
        consent=payload.consent,
    )
    db.add(participant)
    db.flush()

    session = GameSession(participant_id=participant.id)
    db.add(session)
    db.commit()
    db.refresh(participant)
    db.refresh(session)

    return SessionBootstrap(participant=ParticipantOut.model_validate(participant), session=SessionOut.model_validate(session))


@app.get("/api/leaderboard", response_model=list[LeaderboardEntry])
def get_leaderboard(limit: int = Query(default=10, ge=1, le=100), db: Session = Depends(get_db)) -> list[LeaderboardEntry]:
    sessions = db.scalars(leaderboard_query(limit)).all()
    return build_leaderboard_entries(sessions)


@app.post("/api/sessions/{session_id}/complete", response_model=SessionCompletionResult)
def complete_session(
    session_id: int, payload: SessionCompleteIn, db: Session = Depends(get_db)
) -> SessionCompletionResult:
    session = db.scalar(
        select(GameSession).options(joinedload(GameSession.participant)).where(GameSession.id == session_id)
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = SessionStatus.COMPLETED.value
    session.score = payload.score
    session.won = payload.won
    session.duration_seconds = payload.duration_seconds
    session.protection_level = payload.protection_level
    session.route_completed = payload.route_completed
    session.destroyed_segments = payload.destroyed_segments
    session.preserved_segments = payload.preserved_segments
    session.failure_reason = payload.failure_reason
    session.extra_data = payload.extra_data
    session.completed_at = datetime.now(UTC)
    db.commit()
    db.refresh(session)

    higher_scores = db.scalar(
        select(func.count(GameSession.id)).where(
            and_(
                GameSession.status == SessionStatus.COMPLETED.value,
                or_(
                    GameSession.score > session.score,
                    and_(GameSession.score == session.score, GameSession.id > session.id),
                ),
            )
        )
    )
    leaderboard = db.scalars(leaderboard_query(10)).all()

    return SessionCompletionResult(
        session=SessionOut.model_validate(session),
        rank=int(higher_scores or 0) + 1,
        leaderboard=build_leaderboard_entries(leaderboard),
    )


@app.get("/api/admin/entries", response_model=AdminEntriesResponse)
def admin_entries(
    search: str | None = Query(default=None),
    sort_by: str = Query(default="score"),
    sort_dir: str = Query(default="desc"),
    winners_only: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> AdminEntriesResponse:
    query = select(GameSession).options(joinedload(GameSession.participant))

    if search:
        search_term = f"%{search.strip()}%"
        query = query.join(GameSession.participant).where(Participant.phone.ilike(search_term))

    if winners_only:
        query = query.where(GameSession.won.is_(True))

    sort_map = {
        "score": GameSession.score,
        "date": GameSession.created_at,
        "completed_at": GameSession.completed_at,
    }
    sort_column = sort_map.get(sort_by, GameSession.score)
    query = query.order_by(sort_column.asc() if sort_dir == "asc" else sort_column.desc(), GameSession.id.desc())

    sessions = db.scalars(query).all()
    items = [
        AdminEntry(
            session_id=session.id,
            participant_id=session.participant_id,
            first_name=session.participant.first_name,
            last_name=session.participant.last_name,
            phone=session.participant.phone,
            telegram=session.participant.telegram,
            score=session.score,
            won=session.won,
            duration_seconds=session.duration_seconds,
            protection_level=session.protection_level,
            status=session.status,
            prize_issued=session.prize_issued,
            created_at=session.created_at,
            completed_at=session.completed_at,
        )
        for session in sessions
    ]
    return AdminEntriesResponse(items=items, total=len(items))


@app.patch("/api/admin/entries/{session_id}", response_model=SessionOut)
def update_prize_issued(
    session_id: int, payload: PrizeIssuedUpdate, db: Session = Depends(get_db)
) -> SessionOut:
    session = db.scalar(select(GameSession).where(GameSession.id == session_id))
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    session.prize_issued = payload.prize_issued
    db.commit()
    db.refresh(session)
    return SessionOut.model_validate(session)


@app.get("/api/admin/export.csv")
def export_csv(db: Session = Depends(get_db)) -> Response:
    sessions = db.scalars(select(GameSession).options(joinedload(GameSession.participant)).order_by(GameSession.id.desc())).all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "session_id",
            "participant_id",
            "first_name",
            "last_name",
            "phone",
            "telegram",
            "score",
            "won",
            "duration_seconds",
            "protection_level",
            "status",
            "prize_issued",
            "created_at",
            "completed_at",
        ]
    )
    for session in sessions:
        participant = session.participant
        writer.writerow(
            [
                session.id,
                participant.id,
                participant.first_name,
                participant.last_name,
                participant.phone,
                participant.telegram or "",
                session.score,
                int(session.won),
                session.duration_seconds,
                session.protection_level,
                session.status,
                int(session.prize_issued),
                session.created_at.isoformat() if session.created_at else "",
                session.completed_at.isoformat() if session.completed_at else "",
            ]
        )
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="ddos-guard-results.csv"'},
    )
