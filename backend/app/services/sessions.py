from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import GameSession, Participant, SessionStatus
from app.schemas import (
    ParticipantCreate,
    ParticipantOut,
    SessionBootstrap,
    SessionCompleteIn,
    SessionCompletionResult,
    SessionOut,
)
from app.services.leaderboard import calculate_rank, fetch_leaderboard
from app.session_result import SessionResultDetails, default_session_result_details


def map_session_out(session: GameSession) -> SessionOut:
    return SessionOut(
        id=session.id,
        participant_id=session.participant_id,
        status=session.status,
        score=session.score,
        won=session.won,
        duration_seconds=session.duration_seconds,
        protection_level=session.protection_level,
        route_completed=session.route_completed,
        destroyed_segments=session.destroyed_segments,
        preserved_segments=session.preserved_segments,
        failure_reason=session.failure_reason,
        prize_issued=session.prize_issued,
        result_details=SessionResultDetails.model_validate(session.result_details or default_session_result_details()),
        created_at=session.created_at,
        completed_at=session.completed_at,
    )


def create_participant_session(db: Session, payload: ParticipantCreate) -> SessionBootstrap:
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

    return SessionBootstrap(participant=ParticipantOut.model_validate(participant), session=map_session_out(session))


def get_session_or_none(db: Session, session_id: int) -> GameSession | None:
    return db.scalar(
        select(GameSession).options(joinedload(GameSession.participant)).where(GameSession.id == session_id)
    )


def complete_game_session(db: Session, session: GameSession, payload: SessionCompleteIn) -> SessionCompletionResult:
    session.status = SessionStatus.COMPLETED.value
    session.score = payload.score
    session.won = payload.won
    session.duration_seconds = payload.duration_seconds
    session.protection_level = payload.protection_level
    session.route_completed = payload.route_completed
    session.destroyed_segments = payload.destroyed_segments
    session.preserved_segments = payload.preserved_segments
    session.failure_reason = payload.failure_reason
    session.result_details = payload.result_details.model_dump(mode="json")
    session.completed_at = datetime.now(UTC)
    db.commit()
    db.refresh(session)

    return SessionCompletionResult(
        session=map_session_out(session),
        rank=calculate_rank(db, session),
        leaderboard=fetch_leaderboard(db, limit=10),
    )
