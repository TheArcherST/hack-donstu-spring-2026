from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.session_result import SessionResultDetails, default_session_result_details


class ParticipantCreate(BaseModel):
    first_name: str = Field(min_length=2, max_length=120)
    last_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=6, max_length=32)
    telegram: str | None = Field(default=None, max_length=120)
    consent: bool

    @field_validator("first_name", "last_name", "phone", mode="before")
    @classmethod
    def strip_required(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("value must be a string")
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("field must not be empty")
        return cleaned

    @field_validator("telegram", mode="before")
    @classmethod
    def strip_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("consent")
    @classmethod
    def validate_consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("consent is required")
        return value


class ParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    phone: str
    telegram: str | None
    consent: bool
    created_at: datetime


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    participant_id: int
    status: str
    score: int
    won: bool
    duration_seconds: int
    protection_level: int
    route_completed: bool
    destroyed_segments: int
    preserved_segments: int
    failure_reason: str | None
    prize_issued: bool
    result_details: SessionResultDetails = Field(default_factory=default_session_result_details)
    created_at: datetime
    completed_at: datetime | None


class SessionBootstrap(BaseModel):
    participant: ParticipantOut
    session: SessionOut


class SessionCompleteIn(BaseModel):
    score: int = Field(ge=0)
    won: bool
    duration_seconds: int = Field(ge=0, le=120)
    protection_level: int = Field(ge=0, le=100)
    route_completed: bool
    destroyed_segments: int = Field(ge=0)
    preserved_segments: int = Field(ge=0)
    failure_reason: str | None = Field(default=None, max_length=255)
    result_details: SessionResultDetails


class SessionCompletionResult(BaseModel):
    session: SessionOut
    rank: int


class AdminEntry(BaseModel):
    session_id: int
    participant_id: int
    first_name: str
    last_name: str
    phone: str
    telegram: str | None
    score: int
    won: bool
    duration_seconds: int
    protection_level: int
    status: str
    prize_issued: bool
    result_details: SessionResultDetails = Field(default_factory=default_session_result_details)
    created_at: datetime
    completed_at: datetime | None


class AdminEntriesResponse(BaseModel):
    items: list[AdminEntry]
    total: int


class PrizeIssuedUpdate(BaseModel):
    prize_issued: bool
