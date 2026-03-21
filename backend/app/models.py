from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SessionStatus(StrEnum):
    CREATED = "created"
    COMPLETED = "completed"


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    first_name: Mapped[str] = mapped_column(String(120))
    last_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(32), index=True)
    telegram: Mapped[str | None] = mapped_column(String(120), nullable=True)
    consent: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sessions: Mapped[list[GameSession]] = relationship(back_populates="participant", cascade="all, delete-orphan")


class GameSession(Base):
    __tablename__ = "game_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(32), default=SessionStatus.CREATED.value, index=True)
    score: Mapped[int] = mapped_column(Integer, default=0, index=True)
    won: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    protection_level: Mapped[int] = mapped_column(Integer, default=0)
    route_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    destroyed_segments: Mapped[int] = mapped_column(Integer, default=0)
    preserved_segments: Mapped[int] = mapped_column(Integer, default=0)
    failure_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prize_issued: Mapped[bool] = mapped_column(Boolean, default=False)
    extra_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    participant: Mapped[Participant] = relationship(back_populates="sessions")
