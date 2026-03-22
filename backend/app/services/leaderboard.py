from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import GameSession, SessionStatus
from app.session_result import SessionResultDetails, default_session_result_details


def leaderboard_query():
    return select(GameSession).options(joinedload(GameSession.participant)).where(
        GameSession.status == SessionStatus.COMPLETED.value
    )


def session_result_details(session: GameSession) -> SessionResultDetails:
    return SessionResultDetails.model_validate(session.result_details or default_session_result_details())


def session_packet_loss_sort_key(session: GameSession) -> tuple[int, int, float, int]:
    result = session_result_details(session)
    return (
        result.network_metrics.packet_loss,
        -result.network_metrics.delivered_packets,
        -(session.completed_at.timestamp() if session.completed_at else 0),
        -session.id,
    )


def sort_sessions_by_packet_loss(sessions: list[GameSession]) -> list[GameSession]:
    return sorted(sessions, key=session_packet_loss_sort_key)

def calculate_rank(db: Session, session: GameSession) -> int:
    sessions = db.scalars(leaderboard_query()).all()
    ranked_sessions = sort_sessions_by_packet_loss(sessions)
    for index, ranked_session in enumerate(ranked_sessions, start=1):
        if ranked_session.id == session.id:
            return index
    return len(ranked_sessions) + 1
