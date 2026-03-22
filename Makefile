.PHONY: bootstrap bootstrap-ml bootstrap-api bootstrap-web \
        dev dev-api dev-ml dev-web \
        test test-api test-ml test-web fmt lint clean \
        db-up db-down db-reset seed-counties ingest features train score

bootstrap: bootstrap-ml bootstrap-api bootstrap-web

bootstrap-ml:
	cd services/ml-engine && poetry install

bootstrap-api:
	@[ -d services/api ] && cd services/api && go mod tidy || echo "services/api not yet scaffolded, skipping"

bootstrap-web:
	@[ -d frontend ] && cd frontend && npm install || echo "frontend not yet scaffolded, skipping"

dev:
	@echo "Run services in separate terminals or wire up a process manager target"

dev-api:
	cd services/api && go run ./cmd/main.go

dev-ml: bootstrap-ml
# 	cp -n services/ml-engine/.env.example services/ml-engine/.env 2>/dev/null || true
	cd services/ml-engine && poetry run uvicorn app.main:app --reload --port 8001

dev-web:
	cd frontend && npm run dev

test:
	$(MAKE) test-api
	$(MAKE) test-ml
	$(MAKE) test-web

test-api:
	cd services/api && go test ./...

test-ml: bootstrap-ml
	cd services/ml-engine && poetry run pytest

test-web:
	cd frontend && npm test

fmt:
	cd services/api && gofmt -w $$(find . -name '*.go')
	cd services/ml-engine && poetry run ruff format .
	cd frontend && npm run format

lint:
	cd services/api && golangci-lint run ./...
	cd services/ml-engine && poetry run ruff check .
	cd frontend && npm run lint

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

clean:
	find . -name "__pycache__" -type d -prune -exec rm -rf {} +
	find . -name ".pytest_cache" -type d -prune -exec rm -rf {} +
	find . -name "node_modules" -type d -prune -exec rm -rf {} +