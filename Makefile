SHELL := /usr/bin/bash

ENV ?= .env.local
COMPOSE := docker compose -f docker-compose.yml --env-file $(ENV)

.PHONY: build up down ps logs health migrate seed restart

build:
	$(COMPOSE) build

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f

health:
	@echo "Checking http://localhost:3000/api/health"
	@curl -sS http://localhost:3000/api/health | jq . || curl -sS http://localhost:3000/api/health || true

migrate:
	$(COMPOSE) exec -T next-app npx prisma migrate deploy

seed:
	$(COMPOSE) exec -T next-app npx tsx prisma/seed.ts

restart:
	$(COMPOSE) up -d --force-recreate
