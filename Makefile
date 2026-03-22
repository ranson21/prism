.PHONY: bootstrap bootstrap-ml bootstrap-api bootstrap-web \
        dev dev-api dev-ml dev-web \
        test test-api test-ml test-web fmt lint clean \
        db-up db-down db-reset seed-counties ingest features train score \
        docker-build docker-up docker-down docker-logs

bootstrap: bootstrap-ml bootstrap-api bootstrap-web

bootstrap-ml:
	cd services/ml-engine && poetry install

bootstrap-api:
	cd services/api && go mod tidy

bootstrap-web:
	cd apps/ui && npm install --legacy-peer-deps

bootstrap-site:
	cd apps/site && npm install --legacy-peer-deps

dev:
	@echo "Run services in separate terminals or wire up a process manager target"

dev-api:
	cd services/api && air

dev-ml: bootstrap-ml
	cd services/ml-engine && poetry run uvicorn app.main:app --reload --port 8001

dev-web: bootstrap-web
	cd apps/ui && npm run dev

dev-site: bootstrap-site
	cd apps/site && npm run dev

test:
	$(MAKE) test-api
	$(MAKE) test-ml
	$(MAKE) test-web

test-api:
	cd services/api && go test ./...

test-ml: bootstrap-ml
	cd services/ml-engine && poetry run pytest

test-web:
	cd apps/ui && npm test

fmt:
	cd services/api && gofmt -w $$(find . -name '*.go')
	cd services/ml-engine && poetry run ruff format .
	cd apps/ui && npm run format

lint:
	cd services/api && golangci-lint run ./...
	cd services/ml-engine && poetry run ruff check .
	cd apps/ui && npm run lint

db-up:
# 	cp -n environments/local/.env.example environments/local/.env 2>/dev/null || true
	docker compose -f environments/local/docker-compose.yml --env-file environments/local/.env up -d postgres

db-down:
	docker compose -f environments/local/docker-compose.yml down

db-reset:
	docker compose -f environments/local/docker-compose.yml down -v
	$(MAKE) db-up

seed-counties:
	cd services/ml-engine && poetry run python -m app.geography.seed_counties

seed-history:
	cd services/ml-engine && poetry run python -m app.scoring.seed_history

ingest:
	curl -s -X POST http://localhost:8001/ingest \
	  -H "Content-Type: application/json" \
	  -d '{}' | jq .

features:
	curl -s -X POST http://localhost:8001/features \
	  -H "Content-Type: application/json" \
	  -d '{"window_days": 90}' | jq .

train:
	curl -s -X POST http://localhost:8001/train | jq .

score:
	curl -s -X POST http://localhost:8001/score | jq .

docker-build:
	docker compose -f environments/local/docker-compose.yml --env-file environments/local/.env build

docker-up:
	docker compose -f environments/local/docker-compose.yml --env-file environments/local/.env up -d

docker-down:
	docker compose -f environments/local/docker-compose.yml --env-file environments/local/.env down

docker-logs:
	docker compose -f environments/local/docker-compose.yml --env-file environments/local/.env logs -f

clean:
	find . -name "__pycache__" -type d -prune -exec rm -rf {} +
	find . -name ".pytest_cache" -type d -prune -exec rm -rf {} +
	find . -name "node_modules" -type d -prune -exec rm -rf {} +