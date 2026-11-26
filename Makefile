.PHONY: up down logs install db-local migrate seed backend frontend test test-backend test-frontend lint openapi

up: ## Full stack in Docker
	docker compose up --build
down:
	docker compose down
logs:
	docker compose logs -f backend
install:
	cd backend && uv sync
	cd frontend && npm ci
db-local: ## Postgres without Docker
	cd backend && uv run python scripts/local_pg.py start
migrate:
	cd backend && uv run alembic upgrade head
seed:
	cd backend && uv run python -m app.seed
backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000
frontend:
	cd frontend && npm run dev
test: test-backend test-frontend
test-backend:
	cd backend && uv run pytest -q
test-frontend:
	cd frontend && npm test
lint:
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && npm run lint && npm run typecheck
openapi: ## Regenerate the typed API client
	cd backend && uv run python -m app.export_openapi ../frontend/openapi.json
	cd frontend && npm run gen:api
