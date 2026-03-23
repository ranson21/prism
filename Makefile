# Auto-load .env if present — exports all vars to sub-processes
-include .env
export

.PHONY: bootstrap bootstrap-ml bootstrap-api bootstrap-web \
        dev dev-api dev-ml dev-web \
        test test-api test-ml test-web fmt lint clean \
        db-up db-down db-reset seed-counties seed-scenarios ingest features train score \
        docker-build docker-up docker-down docker-logs \
        aws-install-deps aws-check aws-bootstrap aws-patch-account \
        infra-plan-dev infra-apply-dev infra-destroy-dev \
        infra-plan-test infra-apply-test infra-destroy-test \
        ecr-login ecr-push-dev ecr-push-test \
        deploy-static-dev deploy-static-test \
        deploy-amplify-dev aws-amplify-url \
        aws-db-migrate aws-seed-data aws-alb-url aws-s3-site-url aws-url

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

# Create S3 state bucket and DynamoDB lock table (run once per AWS account).
# Bucket name is scoped to your account ID to avoid global S3 naming collisions.
aws-bootstrap:
	$(eval REGION     ?= us-east-1)
	$(eval ACCOUNT_ID  = $(shell aws sts get-caller-identity --query Account --output text))
	$(eval BUCKET     ?= prism-tfstate-$(ACCOUNT_ID))
	$(eval TABLE      ?= prism-terraform-locks)
	@echo "→ Creating state bucket: $(BUCKET)"
	aws s3api create-bucket --bucket $(BUCKET) --region $(REGION)
	aws s3api put-bucket-versioning --bucket $(BUCKET) \
	  --versioning-configuration Status=Enabled
	aws s3api put-bucket-encryption --bucket $(BUCKET) \
	  --server-side-encryption-configuration \
	  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
	aws s3api put-public-access-block --bucket $(BUCKET) \
	  --public-access-block-configuration \
	  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'
	@echo "→ Creating lock table: $(TABLE)"
	aws dynamodb create-table \
	  --table-name $(TABLE) \
	  --attribute-definitions AttributeName=LockID,AttributeType=S \
	  --key-schema AttributeName=LockID,KeyType=HASH \
	  --billing-mode PAY_PER_REQUEST \
	  --region $(REGION)
	@echo ""
	@echo "✓ State backend ready. Export these before running terragrunt:"
	@echo ""
	@echo "  export TF_STATE_BUCKET=$(BUCKET)"
	@echo "  export TF_LOCK_TABLE=$(TABLE)"
	@echo ""
	@echo "Add them to your ~/.bashrc or ~/.zshrc to make them permanent."

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
	# ECS/WAF are excluded from plan-all: ECS does real subnet data-source lookups
	# that fail with mock IDs; both will plan correctly once VPC is applied.
	cd environments/dev/vpc        && terragrunt plan --terragrunt-non-interactive
	cd environments/dev/sg         && terragrunt plan --terragrunt-non-interactive
	cd environments/dev/s3         && terragrunt plan --terragrunt-non-interactive
	cd environments/dev/ecr        && terragrunt plan --terragrunt-non-interactive
	cd environments/dev/rds        && terragrunt plan --terragrunt-non-interactive
	cd environments/dev/alb        && terragrunt plan --terragrunt-non-interactive
	cd environments/dev/cloudfront && terragrunt plan --terragrunt-non-interactive

infra-apply-dev:
	cd environments/dev/vpc        && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/dev/sg         && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/dev/s3         && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/dev/ecr        && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/dev/rds        && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/dev/alb        && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/dev/waf        && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/dev/ecs        && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/dev/cloudfront && terragrunt apply -auto-approve --terragrunt-non-interactive

infra-destroy-dev:
	cd environments/dev && terragrunt run-all destroy --terragrunt-non-interactive

# ── Infra: test ───────────────────────────────────────────────────────────────

infra-plan-test:
	cd environments/test/vpc        && terragrunt plan --terragrunt-non-interactive
	cd environments/test/sg         && terragrunt plan --terragrunt-non-interactive
	cd environments/test/s3         && terragrunt plan --terragrunt-non-interactive
	cd environments/test/ecr        && terragrunt plan --terragrunt-non-interactive
	cd environments/test/rds        && terragrunt plan --terragrunt-non-interactive
	cd environments/test/alb        && terragrunt plan --terragrunt-non-interactive
	cd environments/test/cloudfront && terragrunt plan --terragrunt-non-interactive

infra-apply-test:
	cd environments/test/vpc        && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/test/sg         && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/test/s3         && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/test/ecr        && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/test/rds        && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/test/alb        && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/test/waf        && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/test/ecs        && terragrunt apply -auto-approve --terragrunt-non-interactive
	cd environments/test/cloudfront && terragrunt apply -auto-approve --terragrunt-non-interactive

infra-destroy-test:
	cd environments/test && terragrunt run-all destroy --terragrunt-non-interactive

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
	cp -r environments/local/migrations services/ml-engine/migrations
	docker build -t $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-api:latest       ./services/api
	docker build -t $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-ml-engine:latest ./services/ml-engine
	rm -rf services/ml-engine/migrations
	docker push $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-api:latest
	docker push $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-ml-engine:latest

ecr-push-test: ecr-login
	$(eval ACCOUNT_ID=$(shell aws sts get-caller-identity --query Account --output text))
	$(eval REGION ?= us-east-1)
	$(eval ENV=test)
	cp -r environments/local/migrations services/ml-engine/migrations
	docker build -t $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-api:latest       ./services/api
	docker build -t $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-ml-engine:latest ./services/ml-engine
	rm -rf services/ml-engine/migrations
	docker push $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-api:latest
	docker push $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/prism-$(ENV)-ml-engine:latest

# ── Static site deploy ────────────────────────────────────────────────────────

# Build site + UI and upload to the CloudFront S3 bucket, then invalidate cache.
# site → uploaded to bucket root (serves index.html at /)
# ui  → uploaded to bucket under /app/ prefix (serves at /app/)
deploy-static-dev:
	$(eval ENV       ?= dev)
	$(eval REGION    ?= us-east-1)
	$(eval ACCOUNT_ID = $(shell aws sts get-caller-identity --query Account --output text))
	$(eval BUCKET     = prism-$(ENV)-static-$(ACCOUNT_ID))
	$(eval ALB_URL    = $(shell aws elbv2 describe-load-balancers \
	                     --query "LoadBalancers[?contains(LoadBalancerName,'prism-$(ENV)')].DNSName" \
	                     --output text --region $(REGION)))
	$(eval CF_ID      = $(shell cd environments/$(ENV)/cloudfront && terragrunt output -raw cloudfront_distribution_id --terragrunt-non-interactive 2>/dev/null))
	@echo "→ Ensuring S3 static website bucket: $(BUCKET)"
	@aws s3 mb s3://$(BUCKET) --region $(REGION) 2>/dev/null || true
	@aws s3api put-public-access-block --bucket $(BUCKET) \
	  --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false
	@aws s3api put-bucket-policy --bucket $(BUCKET) --policy \
	  "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":\"*\",\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::$(BUCKET)/*\"}]}"
	@aws s3 website s3://$(BUCKET) --index-document index.html --error-document index.html
	@echo "→ Building site..."
	cd apps/site && VITE_DASHBOARD_URL=http://$(BUCKET).s3-website-$(REGION).amazonaws.com/app npm run build
	@echo "→ Building UI (API: http://$(ALB_URL))..."
	cd apps/ui && VITE_API_URL=http://$(ALB_URL) npm run build -- --base=/app/
	@echo "→ Uploading site to s3://$(BUCKET)/..."
	aws s3 sync apps/site/dist/ s3://$(BUCKET)/ --delete --region $(REGION)
	@echo "→ Uploading UI to s3://$(BUCKET)/app/..."
	aws s3 sync apps/ui/dist/  s3://$(BUCKET)/app/ --delete --region $(REGION)
	@if [ -n "$(CF_ID)" ]; then \
	  echo "→ Invalidating CloudFront cache..."; \
	  aws cloudfront create-invalidation --distribution-id $(CF_ID) --paths "/*" --region $(REGION); \
	fi
	@echo ""
	@echo "✓ Static deploy complete"
	@echo "  Landing site: http://$(BUCKET).s3-website-$(REGION).amazonaws.com"
	@echo "  Dashboard:    http://$(BUCKET).s3-website-$(REGION).amazonaws.com/app"

deploy-static-test:
	$(eval ENV    ?= test)
	$(eval REGION ?= us-east-1)
	$(eval BUCKET  = $(shell cd environments/$(ENV)/cloudfront && terragrunt output -raw static_bucket_name --terragrunt-non-interactive 2>/dev/null))
	$(eval CF_ID   = $(shell cd environments/$(ENV)/cloudfront && terragrunt output -raw cloudfront_distribution_id --terragrunt-non-interactive 2>/dev/null))
	@echo "→ Building site..."
	cd apps/site && VITE_DASHBOARD_URL=/app npm run build
	@echo "→ Building UI..."
	cd apps/ui  && npm run build -- --base=/app/
	@echo "→ Uploading site to s3://$(BUCKET)/..."
	aws s3 sync apps/site/dist/ s3://$(BUCKET)/ --delete --region $(REGION)
	@echo "→ Uploading UI to s3://$(BUCKET)/app/..."
	aws s3 sync apps/ui/dist/  s3://$(BUCKET)/app/ --delete --region $(REGION)
	@if [ -n "$(CF_ID)" ]; then \
	  echo "→ Invalidating CloudFront cache..."; \
	  aws cloudfront create-invalidation --distribution-id $(CF_ID) --paths "/*" --region $(REGION); \
	else \
	  echo "→ Skipping invalidation (CloudFront not yet deployed)"; \
	fi
	@echo "✓ Static deploy complete"

# ── Amplify HTTPS hosting (CloudFront-independent, demo-ready) ───────────────
#
# Deploys two Amplify apps (site + dashboard) with HTTPS via amplifyapp.com.
# Does not require direct CloudFront access — Amplify uses its own service role.
# Run once to create apps, then re-run to redeploy. Swap to CloudFront later.

deploy-amplify-dev:
	$(eval ENV    ?= dev)
	$(eval REGION ?= us-east-1)
	$(eval ALB_URL = $(shell aws elbv2 describe-load-balancers \
	                   --query "LoadBalancers[?contains(LoadBalancerName,'prism-$(ENV)')].DNSName" \
	                   --output text --region $(REGION)))
	@set -e; \
	R=$(REGION); ENV=$(ENV); ALB=http://$(ALB_URL); \
	\
	echo "→ Getting or creating Amplify app: prism-$$ENV-dashboard"; \
	UI_ID=$$(aws amplify list-apps --region $$R \
	  --query "apps[?name=='prism-$$ENV-dashboard'].appId" --output text); \
	if [ -z "$$UI_ID" ]; then \
	  UI_ID=$$(aws amplify create-app --name prism-$$ENV-dashboard --region $$R \
	    --custom-rules '[{"source":"/<*>","target":"/index.html","status":"200"}]' \
	    --query "app.appId" --output text); \
	  aws amplify create-branch --app-id $$UI_ID --branch-name prod \
	    --region $$R > /dev/null; \
	  echo "  Created: $$UI_ID"; \
	else echo "  Existing: $$UI_ID"; fi; \
	\
	echo "→ Getting or creating Amplify app: prism-$$ENV-site"; \
	SITE_ID=$$(aws amplify list-apps --region $$R \
	  --query "apps[?name=='prism-$$ENV-site'].appId" --output text); \
	if [ -z "$$SITE_ID" ]; then \
	  SITE_ID=$$(aws amplify create-app --name prism-$$ENV-site --region $$R \
	    --custom-rules '[{"source":"/<*>","target":"/index.html","status":"200"}]' \
	    --query "app.appId" --output text); \
	  aws amplify create-branch --app-id $$SITE_ID --branch-name prod \
	    --region $$R > /dev/null; \
	  echo "  Created: $$SITE_ID"; \
	else echo "  Existing: $$SITE_ID"; fi; \
	\
	DASH_URL=https://prod.$$UI_ID.amplifyapp.com; \
	\
	echo "→ Building dashboard (API: $$ALB)..."; \
	cd apps/ui && VITE_API_URL=$$ALB npm run build; \
	cd -; \
	\
	echo "→ Building site (dashboard: $$DASH_URL)..."; \
	cd apps/site && VITE_DASHBOARD_URL=$$DASH_URL npm run build; \
	cd -; \
	\
	echo "→ Deploying dashboard to Amplify..."; \
	aws amplify create-deployment --app-id $$UI_ID --branch-name prod \
	  --region $$R > /tmp/prism-ui-deploy.json; \
	UI_JOB=$$(python3 -c "import json; print(json.load(open('/tmp/prism-ui-deploy.json'))['jobId'])"); \
	UI_ZIP=$$(python3 -c "import json; print(json.load(open('/tmp/prism-ui-deploy.json'))['zipUploadUrl'])"); \
	cd apps/ui/dist && zip -r /tmp/prism-ui.zip . > /dev/null && cd -; \
	curl -s -H "Content-Type: application/zip" --upload-file /tmp/prism-ui.zip "$$UI_ZIP" > /dev/null; \
	aws amplify start-deployment --app-id $$UI_ID --branch-name prod \
	  --job-id $$UI_JOB --region $$R > /dev/null; \
	\
	echo "→ Deploying site to Amplify..."; \
	aws amplify create-deployment --app-id $$SITE_ID --branch-name prod \
	  --region $$R > /tmp/prism-site-deploy.json; \
	SITE_JOB=$$(python3 -c "import json; print(json.load(open('/tmp/prism-site-deploy.json'))['jobId'])"); \
	SITE_ZIP=$$(python3 -c "import json; print(json.load(open('/tmp/prism-site-deploy.json'))['zipUploadUrl'])"); \
	cd apps/site/dist && zip -r /tmp/prism-site.zip . > /dev/null && cd -; \
	curl -s -H "Content-Type: application/zip" --upload-file /tmp/prism-site.zip "$$SITE_ZIP" > /dev/null; \
	aws amplify start-deployment --app-id $$SITE_ID --branch-name prod \
	  --job-id $$SITE_JOB --region $$R > /dev/null; \
	\
	echo ""; \
	echo "✓ Amplify deploy started (live in ~1 minute)"; \
	echo "  Landing site: https://prod.$$SITE_ID.amplifyapp.com"; \
	echo "  Dashboard:    https://prod.$$UI_ID.amplifyapp.com"

aws-amplify-url:
	$(eval ENV    ?= dev)
	$(eval REGION ?= us-east-1)
	@UI_ID=$$(aws amplify list-apps --region $(REGION) \
	  --query "apps[?name=='prism-$(ENV)-dashboard'].appId" --output text); \
	SITE_ID=$$(aws amplify list-apps --region $(REGION) \
	  --query "apps[?name=='prism-$(ENV)-site'].appId" --output text); \
	echo "Landing site: https://prod.$$SITE_ID.amplifyapp.com"; \
	echo "Dashboard:    https://prod.$$UI_ID.amplifyapp.com"

# ── Seeding & data pipeline ───────────────────────────────────────────────────

# Run SQL migrations via ECS Exec into the ml-engine task (stays inside the VPC — no public DB access).
# Requires: ECS stack deployed with execute_command enabled, ml-engine task running.
aws-db-migrate:
	$(eval ENV    ?= dev)
	$(eval REGION ?= us-east-1)
	$(eval CLUSTER = prism-$(ENV))
	$(eval TASK_ARN = $(shell aws ecs list-tasks --cluster $(CLUSTER) --service-name ml-engine \
	  --query 'taskArns[0]' --output text --region $(REGION) 2>/dev/null))
	@echo "→ Running migrations via ECS Exec (task: $(TASK_ARN))..."
	aws ecs execute-command --cluster $(CLUSTER) --task $(TASK_ARN) --container ml-engine \
	  --command "python -m app.migrate" --interactive --region $(REGION)
	@echo "✓ Migrations complete"

# Seed counties and run the full ML pipeline via ECS Exec into the ml-engine task.
# Requires: ECS stack deployed, images pushed, tasks running.
aws-seed-data:
	$(eval ENV    ?= dev)
	$(eval REGION ?= us-east-1)
	$(eval CLUSTER = prism-$(ENV))
	$(eval TASK_ARN = $(shell aws ecs list-tasks --cluster $(CLUSTER) --service-name ml-engine \
	  --query 'taskArns[0]' --output text --region $(REGION)))
	@echo "→ Seeding counties..."
	aws ecs execute-command --cluster $(CLUSTER) --task $(TASK_ARN) --container ml-engine \
	  --command "python -m app.geography.seed_counties" --interactive --region $(REGION)
	@echo "→ Running ingest..."
	aws ecs execute-command --cluster $(CLUSTER) --task $(TASK_ARN) --container ml-engine \
	  --command "python -m app.ingestion.ingest" --interactive --region $(REGION)
	@echo "→ Building features..."
	aws ecs execute-command --cluster $(CLUSTER) --task $(TASK_ARN) --container ml-engine \
	  --command "python -m app.features.build" --interactive --region $(REGION)
	@echo "→ Training model..."
	aws ecs execute-command --cluster $(CLUSTER) --task $(TASK_ARN) --container ml-engine \
	  --command "python -m app.scoring.train" --interactive --region $(REGION)
	@echo "→ Scoring counties..."
	aws ecs execute-command --cluster $(CLUSTER) --task $(TASK_ARN) --container ml-engine \
	  --command "python -m app.scoring.score" --interactive --region $(REGION)
	@echo "✓ Pipeline complete"

# Print the ALB HTTP URL (available immediately, no CloudFront needed)
aws-alb-url:
	$(eval ENV    ?= dev)
	$(eval REGION ?= us-east-1)
	@echo "http://$$(aws elbv2 describe-load-balancers \
	  --query \"LoadBalancers[?contains(LoadBalancerName,'prism-$(ENV)')].DNSName\" \
	  --output text --region $(REGION))"

# Print the S3 static website URL (available before CloudFront)
aws-s3-site-url:
	$(eval ENV       ?= dev)
	$(eval REGION    ?= us-east-1)
	$(eval ACCOUNT_ID = $(shell aws sts get-caller-identity --query Account --output text))
	@echo "Landing site: http://prism-$(ENV)-static-$(ACCOUNT_ID).s3-website-$(REGION).amazonaws.com"
	@echo "Dashboard:    http://prism-$(ENV)-static-$(ACCOUNT_ID).s3-website-$(REGION).amazonaws.com/app"

# Print the shareable CloudFront HTTPS URL for an environment
aws-url:
	$(eval ENV ?= dev)
	@echo "https://$$(cd environments/$(ENV)/cloudfront && terragrunt output -raw cloudfront_domain_name --terragrunt-non-interactive 2>/dev/null)"