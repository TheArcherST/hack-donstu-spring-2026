-include .env
export

.PHONY: up down logs build ps restart

up:
	docker compose --env-file .env up --build -d

down:
	docker compose --env-file .env down

logs:
	docker compose --env-file .env logs -f

build:
	docker compose --env-file .env build

ps:
	docker compose --env-file .env ps

restart:
	docker compose --env-file .env restart
