PY=python3.11
build:
	docker compose -f infra/docker-compose.yml build

up:
	docker compose -f infra/docker-compose.yml up -d
	docker compose -f infra/docker-compose.yml ps

down:
	docker compose -f infra/docker-compose.yml down
	docker compose -f infra/docker-compose.yml ps

ingest:
	docker compose -f infra/docker-compose.yml run --rm api python scripts/ingest.py

seed:
	docker compose -f infra/docker-compose.yml run --rm api python scripts/seed.py

test:
	docker compose -f infra/docker-compose.yml run --rm api pytest -q
test:
	$(PY) -m pytest -q
