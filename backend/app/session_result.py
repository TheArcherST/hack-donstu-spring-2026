from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ChannelState = Literal["overloaded", "partial", "guarded"]


class NetworkMetrics(BaseModel):
    link_quality: int = Field(default=0, ge=0, le=100)
    packet_loss: int = Field(default=0, ge=0, le=100)
    throughput: int = Field(default=0, ge=0, le=100)
    latency_ms: int = Field(default=0, ge=0)
    delivered_packets: int = Field(default=0, ge=0)
    dropped_packets: int = Field(default=0, ge=0)
    delivery_rate: int = Field(default=0, ge=0, le=100)
    channel_state: ChannelState = "overloaded"


class StabilityWindow(BaseModel):
    hold_seconds: int = Field(default=0, ge=0)
    target_seconds: int = Field(default=8, ge=1)


class AttackSummary(BaseModel):
    system_integrity: int = Field(default=0, ge=0, le=100)
    attack_intensity: int = Field(default=0, ge=0, le=100)


class SessionResultDetails(BaseModel):
    network_metrics: NetworkMetrics = Field(default_factory=NetworkMetrics)
    stability_window: StabilityWindow = Field(default_factory=StabilityWindow)
    attack_summary: AttackSummary = Field(default_factory=AttackSummary)


def default_session_result_details() -> SessionResultDetails:
    return SessionResultDetails()
