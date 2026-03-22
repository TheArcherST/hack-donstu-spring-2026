-include .env
export

DOCKER_BUILD_ENV=DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1

.PHONY: up down logs build ps restart prepare-nginx

up: prepare-nginx
	$(DOCKER_BUILD_ENV) docker compose --env-file .env up --build -d

down:
	docker compose --env-file .env down

logs:
	docker compose --env-file .env logs -f

build:
	$(DOCKER_BUILD_ENV) docker compose --env-file .env build --parallel

ps:
	docker compose --env-file .env ps

restart:
	docker compose --env-file .env restart

prepare-nginx:
	@if [ ! -f deploy/nginx/nginx.conf ]; then \
		cp deploy/nginx/nginx.conf.example deploy/nginx/nginx.conf; \
		echo "Created deploy/nginx/nginx.conf from example. Review server_name and TLS settings before production deploy."; \
	fi
