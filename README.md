# DDoS-Guard: Линия защиты

Mobile-first браузерная игра для стенда DDoS-Guard с лид-формой, игровой сессией на 60-90 секунд, публичным рейтингом и админкой.

## Стек

- Frontend: React + TypeScript + Vite
- Game scene: HTML5 Canvas
- Backend: FastAPI + SQLAlchemy + PostgreSQL
- Deploy: Docker Compose + Makefile

## Запуск

1. Скопировать `.env.example` в `.env`.
2. Выполнить `make up`.
3. Открыть `http://localhost:<COMPOSE__FRONTEND__PORT>` из `.env`.
4. Админка доступна по `http://localhost:<COMPOSE__FRONTEND__PORT>/admin`.

Публикация портов сервисов настраивается через поля вида `COMPOSE__<SERVICE>__HOST` и `COMPOSE__<SERVICE>__PORT`.
По умолчанию сервисы слушают только `127.0.0.1`; если нужно открыть их наружу, выставьте соответствующий `COMPOSE__...__HOST=0.0.0.0`.

## API

- `POST /api/participants` - создать участника и игровую сессию
- `POST /api/sessions/{session_id}/complete` - сохранить результат матча
- `GET /api/leaderboard` - публичный рейтинг
- `GET /api/admin/entries` - список участников для админки
- `GET /api/admin/export.csv` - CSV-экспорт
- `PATCH /api/admin/entries/{session_id}` - отметить выдачу приза
