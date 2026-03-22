.PHONY: bootstrap bootstrap-ml bootstrap-api bootstrap-web \
        dev dev-api dev-ml dev-web \
        test test-api test-ml test-web fmt lint clean \
        db-up db-down db-reset seed-counties seed-scenarios ingest features train score \
        docker-build docker-up docker-down docker-logs \
        aws-install-deps aws-check aws-bootstrap aws-patch-account \
        infra-plan-dev infra-apply-dev infra-destroy-dev \
        infra-plan-test infra-apply-test infra-destroy-test \
        ecr-login ecr-push-dev ecr-push-test

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

seed-scenarios:
	cd services/ml-engine && poetry run python -m app.scenarios.seed_scenarios

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

# ── AWS / Terragrunt ──────────────────────────────────────────────────────────

# Install Terraform, Terragrunt, and AWS CLI v2 on Ubuntu
aws-install-deps:
	@echo "→ Installing Terraform..."
	sudo apt-get update -qq && sudo apt-get install -y gnupg software-properties-common curl unzip wget
	wget -qO- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg > /dev/null
	echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $$(lsb_release -cs) main" \
	  | sudo tee /etc/apt/sources.list.d/hashicorp.list
	sudo apt-get update -qq && sudo apt-get install -y terraform
	@echo "→ Installing Terragrunt..."
	$(eval TGVER=$(shell curl -s https://api.github.com/repos/gruntwork-io/terragrunt/releases/latest | grep tag_name | cut -d'"' -f4))
	wget -qO /tmp/terragrunt https://github.com/gruntwork-io/terragrunt/releases/download/$(TGVER)/terragrunt_linux_amd64
	chmod +x /tmp/terragrunt && sudo mv /tmp/terragrunt /usr/local/bin/terragrunt
	@echo "→ Installing AWS CLI v2..."
	curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
	unzip -q /tmp/awscliv2.zip -d /tmp && sudo /tmp/aws/install --update
	rm -rf /tmp/awscliv2.zip /tmp/aws
	@echo "✓ Done — run: aws configure"

# Verify AWS credentials are set up
aws-check:
	@aws sts get-caller-identity

# Create S3 state bucket and DynamoDB lock table (run once per AWS account)
aws-bootstrap:
	$(eval REGION ?= us-east-1)
	$(eval BUCKET ?= prism-terraform-state)
	$(eval TABLE  ?= prism-terraform-locks)
	@echo "→ Creating state bucket: $(BUCKET)"
	aws s3api create-bucket --bucket $(BUCKET) --region $(REGION)
	aws s3api put-bucket-versioning --bucket $(BUCKET) \
	  --versioning-configuration Status=Enabled
	aws s3api put-bucket-encryption --bucket $(BUCKET) \
	  --server-side-encryption-configuration \
	  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
	@echo "→ Creating lock table: $(TABLE)"
	aws dynamodb create-table \
	  --table-name $(TABLE) \
	  --attribute-definitions AttributeName=LockID,AttributeType=S \
	  --key-schema AttributeName=LockID,KeyType=HASH \
	  --billing-mode PAY_PER_REQUEST \
	  --region $(REGION)
	@echo "✓ State backend ready"

# Replace ACCOUNT_ID placeholder in ECS configs with the real AWS account ID
aws-patch-account:
	$(eval ACCOUNT_ID=$(shell aws sts get-caller-identity --query Account --output text))
	@echo "→ Patching ACCOUNT_ID → $(ACCOUNT_ID)"
	sed -i "s/ACCOUNT_ID/$(ACCOUNT_ID)/g" environments/dev/ecs/terragrunt.hcl
	sed -i "s/ACCOUNT_ID/$(ACCOUNT_ID)/g" environments/test/ecs/terragrunt.hcl
	sed -i "s/ACCOUNT_ID/$(ACCOUNT_ID)/g" environments/stable/ecs/terragrunt.hcl
	@echo "✓ Done"

# ── Infra: dev ────────────────────────────────────────────────────────────────

infra-plan-dev:
	cd environments/dev && terragrunt run-all plan

infra-apply-dev:
	cd environments/dev/vpc && terragrunt apply -auto-approve
	cd environments/dev/s3  && terragrunt apply -auto-approve
	cd environments/dev/ecr && terragrunt apply -auto-approve
	cd environments/dev/rds && terragrunt apply -auto-approve
	cd environments/dev/alb && terragrunt apply -auto-approve
	cd environments/dev/waf && terragrunt apply -auto-approve
	cd environments/dev/ecs && terragrunt apply -auto-approve

infra-destroy-dev:
	cd environments/dev && terragrunt run-all destroy

# ── Infra: test ───────────────────────────────────────────────────────────────

infra-plan-test:
	cd environments/test && terragrunt run-all plan

infra-apply-test:
	cd environments/test/vpc && terragrunt apply -auto-approve
	cd environments/test/s3  && terragrunt apply -auto-approve
	cd environments/test/ecr && terragrunt apply -auto-approve
	cd environments/test/rds && terragrunt apply -auto-approve
	cd environments/test/alb && terragrunt apply -auto-approve
	cd environments/test/waf && terragrunt apply -auto-approve
	cd environments/test/ecs && terragrunt apply -auto-approve

infra-destroy-test:
	cd environments/test && terragrunt run-all destroy

# ── ECR image push ────────────────────────────────────────────────────────────

ecr-login:
	$(eval ACCOUNT_ID=$(shell aws sts get-caller-identity --query Account --output text))
	$(eval REGION ?= us-east-1)
	aws ecr get-login-password --region $(REGION) \
	  | docker login --username AWS --password-stdin \
	    $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com

ecr-push-dev: ecr-login
	$(eval ACCOUNT_ID=$(shell aws sts get-caller-identity --query Account --output text))
	$(eval REGION ?= us-east-1)
	$(eval ENV=dev)
	docker build -t $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-api:latest       ./services/api
	docker build -t $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-ml-engine:latest ./services/ml-engine
	docker build -t $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-ui:latest        ./apps/ui
	docker push $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-api:latest
	docker push $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-ml-engine:latest
	docker push $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-ui:latest

ecr-push-test: ecr-login
	$(eval ACCOUNT_ID=$(shell aws sts get-caller-identity --query Account --output text))
	$(eval REGION ?= us-east-1)
	$(eval ENV=test)
	docker build -t $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-api:latest       ./services/api
	docker build -t $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-ml-engine:latest ./services/ml-engine
	docker build -t $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-ui:latest        ./apps/ui
	docker push $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-api:latest
	docker push $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-ml-engine:latest
	docker push $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-ui:latest