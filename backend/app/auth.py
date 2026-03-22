from __future__ import annotations

from secrets import compare_digest

from fastapi import Header, HTTPException, status

from app.config import get_settings


def require_admin_password(x_admin_password: str | None = Header(default=None)) -> None:
    settings = get_settings()
    configured_password = settings.admin_password

    if not configured_password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Пароль админки не настроен в окружении.",
        )

    if not x_admin_password or not compare_digest(x_admin_password, configured_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный пароль админки.",
            headers={"WWW-Authenticate": "AdminPassword"},
        )
