# DDoS-Guard: Линия защиты

Mobile-first браузерная игра для стенда DDoS-Guard с лид-формой, игровой сессией на 60-90 секунд, публичным рейтингом и админкой.

## Стек

- Frontend: React + TypeScript + Vite
- Game scene: HTML5 Canvas
- Backend: FastAPI + SQLAlchemy + PostgreSQL
- Deploy: Docker Compose + Makefile

## Запуск

1. Скопировать `.env.example` в `.env`.
2. При первом запуске `make up` автоматически создаст `deploy/nginx/nginx.conf` и `deploy/nginx/conf.d/default.conf` из шаблонов.
3. При необходимости отредактировать `deploy/nginx/conf.d/default.conf`: указать домен в `server_name` и включить TLS-блок.
4. Положить сертификаты в `deploy/nginx/certs/`, если нужен HTTPS.
5. Выполнить `make up`.
6. Открыть `http://localhost:<COMPOSE__NGINX__HTTP_PORT>` из `.env`.
7. Админка доступна по `http://localhost:<COMPOSE__NGINX__HTTP_PORT>/admin`.

Наружу публикуется только reverse proxy `nginx`; frontend и backend остаются внутри docker-сети.
Публикация портов прокси настраивается через `COMPOSE__NGINX__HOST`, `COMPOSE__NGINX__HTTP_PORT` и `COMPOSE__NGINX__HTTPS_PORT`.
По умолчанию прокси слушает только `127.0.0.1`; если нужно открыть проект наружу, выставьте `COMPOSE__NGINX__HOST=0.0.0.0`.

## Nginx reverse proxy

- Корневой шаблон `nginx.conf` лежит в `deploy/nginx/nginx.conf.example`.
- Шаблон виртуального хоста лежит в `deploy/nginx/conf.d/default.conf.example`.
- Рабочие файлы: `deploy/nginx/nginx.conf` и `deploy/nginx/conf.d/default.conf`. Эти файлы не коммитятся и предназначены для правок под конкретный сервер.
- Каталог `deploy/nginx/certs/` зарезервирован под `fullchain.pem` и `privkey.pem` либо другие сертификаты, на которые вы сошлётесь в `deploy/nginx/conf.d/default.conf`.
- Внутри compose основной `nginx.conf` подключает `/etc/nginx/conf.d/*.conf`, а `default.conf` маршрутизирует `/api/` в FastAPI backend и все остальные запросы во frontend.

## API

- `POST /api/participants` - создать участника и игровую сессию
- `POST /api/sessions/{session_id}/complete` - сохранить результат матча
- `GET /api/leaderboard` - публичный рейтинг
- `GET /api/admin/entries` - список участников для админки
- `GET /api/admin/export.csv` - CSV-экспорт
- `PATCH /api/admin/entries/{session_id}` - отметить выдачу приза
