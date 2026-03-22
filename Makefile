.PHONY: bootstrap dev dev-api dev-ml dev-web test test-api test-ml test-web fmt lint clean \
        db-up db-down db-reset ingest

bootstrap:
	cd services/ml-engine && poetry install
	cd services/api && go mod tidy
	cd frontend && npm install

dev:
	@echo "Run services in separate terminals or wire up a process manager target"

dev-api:
	cd services/api && go run ./cmd/main.go

dev-ml:
	cd services/ml-engine && poetry run uvicorn app.main:app --reload

dev-web:
	cd frontend && npm run dev

test:
	$(MAKE) test-api
	$(MAKE) test-ml
	$(MAKE) test-web

test-api:
	cd services/api && go test ./...

test-ml:
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
	cp -n environments/local/.env.example environments/local/.env 2>/dev/null || true
	docker compose -f environments/local/docker-compose.yml --env-file environments/local/.env up -d postgres

db-down:
	docker compose -f environments/local/docker-compose.yml down

db-reset:
	docker compose -f environments/local/docker-compose.yml down -v
	$(MAKE) db-up

ingest:
	curl -s -X POST http://localhost:8001/ingest \
	  -H "Content-Type: application/json" \
	  -d '{}' | jq .

clean:
	find . -name "__pycache__" -type d -prune -exec rm -rf {} +
	find . -name ".pytest_cache" -type d -prune -exec rm -rf {} +
	find . -name "node_modules" -type d -prune -exec rm -rf {} +