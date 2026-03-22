from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    LeaderboardEntry,
    ParticipantCreate,
    SessionBootstrap,
    SessionCompleteIn,
    SessionCompletionResult,
)
from app.services.leaderboard import fetch_leaderboard
from app.services.sessions import complete_game_session, create_participant_session, get_session_or_none

router = APIRouter(prefix="/api")


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/participants", response_model=SessionBootstrap)
def create_participant(payload: ParticipantCreate, db: Session = Depends(get_db)) -> SessionBootstrap:
    return create_participant_session(db, payload)


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def get_leaderboard(limit: int = Query(default=10, ge=1, le=100), db: Session = Depends(get_db)) -> list[LeaderboardEntry]:
    return fetch_leaderboard(db, limit=limit)


@router.post("/sessions/{session_id}/complete", response_model=SessionCompletionResult)
def complete_session(
    session_id: int,
    payload: SessionCompleteIn,
    db: Session = Depends(get_db),
) -> SessionCompletionResult:
    session = get_session_or_none(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return complete_game_session(db, session, payload)
