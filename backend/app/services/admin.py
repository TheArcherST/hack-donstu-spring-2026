from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import GameSession, Participant
from app.session_result import SessionResultDetails, default_session_result_details
from app.schemas import AdminEntriesResponse, AdminEntry, PrizeIssuedUpdate, SessionOut
from app.services.sessions import map_session_out

AdminSortBy = Literal["score", "date", "completed_at"]
SortDirection = Literal["asc", "desc"]


def sort_sessions_for_admin(
    sessions: list[GameSession],
    *,
    sort_by: AdminSortBy,
    sort_dir: SortDirection,
) -> list[GameSession]:
    if sort_by != "score":
        return sessions

    reverse = sort_dir != "desc"
    return sorted(
        sessions,
        key=lambda session: (
            SessionResultDetails.model_validate(session.result_details or default_session_result_details()).network_metrics.packet_loss,
            -SessionResultDetails.model_validate(session.result_details or default_session_result_details()).network_metrics.delivered_packets,
            -(session.completed_at.timestamp() if session.completed_at else 0),
            -session.id,
        ),
        reverse=reverse,
    )


def build_admin_entries_query(
    *,
    search: str | None,
    sort_by: AdminSortBy,
    sort_dir: SortDirection,
    winners_only: bool,
    window_hours: int,
):
    query = select(GameSession).options(joinedload(GameSession.participant))

    if search:
        search_term = f"%{search.strip()}%"
        query = query.join(GameSession.participant).where(Participant.phone.ilike(search_term))

    if winners_only:
        query = query.where(GameSession.won.is_(True))

    if window_hours > 0:
        created_after = datetime.now(timezone.utc) - timedelta(hours=window_hours)
        query = query.where(GameSession.created_at >= created_after)

    sort_map = {
        "score": GameSession.score,
        "date": GameSession.created_at,
        "completed_at": GameSession.completed_at,
    }
    sort_column = sort_map[sort_by]
    return query.order_by(sort_column.asc() if sort_dir == "asc" else sort_column.desc(), GameSession.id.desc())


def fetch_admin_entries(
    db: Session,
    *,
    search: str | None,
    sort_by: AdminSortBy,
    sort_dir: SortDirection,
    winners_only: bool,
    window_hours: int,
) -> AdminEntriesResponse:
    sessions = db.scalars(
        build_admin_entries_query(
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            winners_only=winners_only,
            window_hours=window_hours,
        )
    ).all()
    sessions = sort_sessions_for_admin(sessions, sort_by=sort_by, sort_dir=sort_dir)
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
            result_details=SessionResultDetails.model_validate(session.result_details or default_session_result_details()),
            created_at=session.created_at,
            completed_at=session.completed_at,
        )
        for session in sessions
    ]
    return AdminEntriesResponse(items=items, total=len(items))


def update_session_prize(db: Session, session_id: int, payload: PrizeIssuedUpdate) -> SessionOut | None:
    session = db.scalar(select(GameSession).where(GameSession.id == session_id))
    if session is None:
        return None

    session.prize_issued = payload.prize_issued
    db.commit()
    db.refresh(session)
    return map_session_out(session)


def export_entries_csv(
    db: Session,
    *,
    search: str | None,
    sort_by: AdminSortBy,
    sort_dir: SortDirection,
    winners_only: bool,
    window_hours: int,
) -> str:
    sessions = db.scalars(
        build_admin_entries_query(
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            winners_only=winners_only,
            window_hours=window_hours,
        )
    ).all()
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
    sessions = sort_sessions_for_admin(sessions, sort_by=sort_by, sort_dir=sort_dir)
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
                session.won,
                session.duration_seconds,
                session.protection_level,
                session.status,
                session.prize_issued,
                session.created_at.isoformat() if session.created_at else "",
                session.completed_at.isoformat() if session.completed_at else "",
            ]
        )

    return buffer.getvalue()
