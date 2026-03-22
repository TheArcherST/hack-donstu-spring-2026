from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import AdminEntriesResponse, PrizeIssuedUpdate, SessionOut
from app.services.admin import AdminSortBy, SortDirection, export_entries_csv, fetch_admin_entries, update_session_prize

router = APIRouter(prefix="/api/admin")


@router.get("/entries", response_model=AdminEntriesResponse)
def admin_entries(
    search: str | None = Query(default=None),
    sort_by: AdminSortBy = Query(default="score"),
    sort_dir: SortDirection = Query(default="desc"),
    winners_only: bool = Query(default=False),
    window_hours: int = Query(default=24, ge=0, le=24 * 365),
    db: Session = Depends(get_db),
) -> AdminEntriesResponse:
    return fetch_admin_entries(
        db,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        winners_only=winners_only,
        window_hours=window_hours,
    )


@router.patch("/entries/{session_id}", response_model=SessionOut)
def update_prize_issued(
    session_id: int,
    payload: PrizeIssuedUpdate,
    db: Session = Depends(get_db),
) -> SessionOut:
    session = update_session_prize(db, session_id, payload)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/export.csv")
def export_csv(
    search: str | None = Query(default=None),
    sort_by: AdminSortBy = Query(default="score"),
    sort_dir: SortDirection = Query(default="desc"),
    winners_only: bool = Query(default=False),
    window_hours: int = Query(default=24, ge=0, le=24 * 365),
    db: Session = Depends(get_db),
) -> Response:
    content = export_entries_csv(
        db,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        winners_only=winners_only,
        window_hours=window_hours,
    )
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="ddos-guard-export.csv"'},
    )
