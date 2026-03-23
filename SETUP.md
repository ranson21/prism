# PRISM — Setup Guide

## Table of Contents

- [Local Development](#local-development)
- [AWS Setup](#aws-setup)
- [First Deployment](#first-deployment)
- [Running the ML Pipeline](#running-the-ml-pipeline)
- [Subsequent Deployments](#subsequent-deployments)
- [Accessing the Application](#accessing-the-application)
- [Environment Reference](#environment-reference)

---

## Local Development

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Go | 1.25+ | https://go.dev/dl |
| Python | 3.11+ | https://python.org |
| Poetry | 1.8+ | `curl -sSL https://install.python-poetry.org \| python3 -` |
| Node.js | 20+ | https://nodejs.org |
| Docker + Compose | 24+ | https://docs.docker.com/get-docker |
| air (Go hot-reload) | latest | `go install github.com/air-verse/air@latest` |

### 1. Clone and install dependencies

```bash
git clone <repo-url> prism && cd prism
make bootstrap          # installs Go, Python, and npm deps
make bootstrap-site     # installs landing site deps (optional)
```

### 2. Configure environment

```bash
cp environments/local/.env.example environments/local/.env
```

Edit `environments/local/.env` and fill in API keys if you have them:

```
FEMA_API_KEY=          # optional — public endpoints work without a key
NOAA_API_KEY=          # optional — some endpoints require one
```

The database credentials are already set for local use and do not need to change.

Copy the root `.env.example` too (used by the Makefile):

```bash
cp .env.example .env
```

### 3. Start the database

```bash
make db-up             # starts PostgreSQL in Docker; runs migrations automatically
```

### 4. Run the data pipeline (first time only)

Open separate terminals or use a process manager:

```bash
make dev-ml            # FastAPI on :8001
```

Then in another terminal, seed and run the full pipeline:

```bash
make seed-counties     # load all 3,000+ US counties
make ingest            # pull from FEMA / NOAA / USGS
make features          # compute feature vectors (90-day window)
make train             # train the risk model
make score             # score all counties
make seed-history      # backfill historical comparisons
make seed-scenarios    # load scenario definitions
```

### 5. Start all services

```bash
make dev-api           # Go API on :8080
make dev-ml            # Python ML Engine on :8001
make dev-web           # React dashboard on :5173
make dev-site          # React landing page on :5174 (optional)
```

Or run everything in Docker:

```bash
make docker-up         # builds and starts all services
make docker-logs       # tail logs
make docker-down       # tear down
```

### Available local URLs

| Service | URL |
|---------|-----|
| Landing site | http://localhost:80 |
| Dashboard | http://localhost:3000 |
| Go API | http://localhost:8080 |
| ML Engine | http://localhost:8001 |
| API health | http://localhost:8080/health |

### Running tests

```bash
make test              # runs all service tests
make test-api          # Go: go test ./...
make test-ml           # Python: pytest
make test-web          # React: npm test
```

---

## AWS Setup

### Prerequisites

| Tool | Notes |
|------|-------|
| AWS CLI v2 | `make aws-install-deps` installs on Ubuntu |
| Terraform | installed by `aws-install-deps` |
| Terragrunt | installed by `aws-install-deps` |
| AWS account | IAM user or role with admin-equivalent permissions |

### 1. Install CLI tools (Ubuntu)

```bash
make aws-install-deps
```

For other platforms install Terraform, Terragrunt, and AWS CLI manually.

### 2. Configure AWS credentials

```bash
aws configure
# or export AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_DEFAULT_REGION
```

Verify:

```bash
make aws-check         # prints your account ID and ARN
```

### 3. Bootstrap remote state (once per account)

Terraform state is stored in S3 with DynamoDB locking. Create the backend resources:

```bash
make aws-bootstrap
```

This prints two export statements. Add them to your shell profile and source it:

```bash
export TF_STATE_BUCKET=prism-tfstate-<your-account-id>
export TF_LOCK_TABLE=prism-terraform-locks
```

Add these to `.env` (loaded automatically by the Makefile):

```
TF_STATE_BUCKET=prism-tfstate-<your-account-id>
TF_LOCK_TABLE=prism-terraform-locks
AWS_DEFAULT_REGION=us-east-1
```

### 4. CloudFront account verification (new AWS accounts only)

New AWS accounts require account verification before CloudFront distributions can be created. If `infra-apply` fails on the CloudFront module with an `AccessDenied` error:

1. Open an AWS Support case requesting CloudFront activation
2. This typically takes a few hours to a business day
3. The rest of the infrastructure deploys fine without it — the ALB URL works immediately
4. Re-run `cd environments/dev/cloudfront && terragrunt apply` once approved

---

## First Deployment

Run these steps in order. Each step depends on the previous one.

### Step 1 — Apply infrastructure

```bash
make infra-apply-dev
```

This runs each Terragrunt module in sequence:

```
vpc → sg → s3 → ecr → rds → alb → waf → ecs → cloudfront
```

The CloudFront module may fail on new accounts (see above). All other modules will succeed.

On first apply this takes 10–15 minutes. RDS provisioning is the slowest step.

### Step 2 — Push container images to ECR

```bash
make ecr-push-dev
```

This builds the Go API and Python ML Engine images and pushes them to ECR. The ML Engine image automatically bundles the SQL migrations from `environments/local/migrations/`.

> **Note:** ECS services start immediately after `infra-apply` but will cycle (exit 1) until images exist in ECR. They stabilize on their own once images are pushed.

### Step 3 — Run database migrations

Migrations run inside the VPC via ECS Exec — no public database access required.

```bash
make aws-db-migrate
```

This opens an interactive ECS Exec session into the running ml-engine task and runs `python -m app.migrate`, which applies all SQL files from `migrations/` in order.

> If ECS Exec fails (SSM agent issues), use `run-task` directly:
> ```bash
> aws ecs run-task \
>   --cluster prism-dev \
>   --task-definition ml-engine \
>   --launch-type FARGATE \
>   --network-configuration '{"awsvpcConfiguration":{"subnets":["<subnet-id>"],"securityGroups":["<sg-id>"],"assignPublicIp":"DISABLED"}}' \
>   --overrides '{"containerOverrides":[{"name":"ml-engine","command":["python","-m","app.migrate"]}]}'
> ```
> Subnet and security group IDs can be found in the ECS service's network configuration.

### Step 4 — Run the ML pipeline

```bash
make aws-seed-data
```

This runs inside the ml-engine ECS task (via ECS Exec):
1. Seeds all US counties into the database
2. Ingests data from FEMA, NOAA, and USGS
3. Computes feature vectors
4. Trains the risk model
5. Scores all counties

The full pipeline takes 5–15 minutes depending on external API response times.

### Step 5 — Deploy static frontend

```bash
make deploy-static-dev
```

Builds the landing site and dashboard, uploads both to S3:
- Landing site → `s3://prism-dev-static-<account-id>/`
- Dashboard → `s3://prism-dev-static-<account-id>/app/`

If CloudFront is deployed, the cache is automatically invalidated. If not yet deployed, this step completes successfully and the files will be served once CloudFront is available.

### Verify the deployment

```bash
make aws-alb-url       # prints the ALB HTTP URL (available immediately)
make aws-url           # prints the CloudFront HTTPS URL (once CF is deployed)
```

Hit the ALB URL to confirm the API is responding:

```bash
curl http://<alb-dns>/health
# → {"status":"ok"}

curl http://<alb-dns>/api/risk/rankings
# → [...county risk scores...]
```

---

## Running the ML Pipeline

### On-demand pipeline run (AWS)

To re-run ingestion and scoring on demand:

```bash
make aws-seed-data ENV=dev
```

Or run individual steps via ECS Exec into the ml-engine task:

```bash
CLUSTER=prism-dev
TASK=$(aws ecs list-tasks --cluster $CLUSTER --service-name ml-engine \
  --query 'taskArns[0]' --output text)

# Individual steps
aws ecs execute-command --cluster $CLUSTER --task $TASK \
  --container ml-engine --command "python -m app.ingestion.ingest" --interactive

aws ecs execute-command --cluster $CLUSTER --task $TASK \
  --container ml-engine --command "python -m app.features.compute" --interactive

aws ecs execute-command --cluster $CLUSTER --task $TASK \
  --container ml-engine --command "python -m app.scoring.train" --interactive

aws ecs execute-command --cluster $CLUSTER --task $TASK \
  --container ml-engine --command "python -m app.scoring.score" --interactive
```

### Session Manager plugin

ECS Exec requires the AWS Session Manager plugin. Install it without sudo:

```bash
mkdir -p ~/.local/bin
curl -s "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o /tmp/ssmplug.deb
dpkg -x /tmp/ssmplug.deb /tmp/ssmplug-extract
cp /tmp/ssmplug-extract/usr/local/sessionmanagerplugin/bin/session-manager-plugin ~/.local/bin/
```

Ensure `~/.local/bin` is on your `PATH`.

---

## Subsequent Deployments

### Deploy a code change

```bash
# Rebuild and push updated images
make ecr-push-dev

# ECS services pull the new :latest image on the next task replacement.
# To force immediate rollout:
aws ecs update-service --cluster prism-dev --service api --force-new-deployment
aws ecs update-service --cluster prism-dev --service ml-engine --force-new-deployment
```

### Deploy a frontend change

```bash
make deploy-static-dev
```

### Apply an infrastructure change

Edit the relevant `environments/dev/<module>/terragrunt.hcl`, then:

```bash
cd environments/dev/<module> && terragrunt apply -auto-approve --terragrunt-non-interactive
```

> **Note:** After changing the ECS module (e.g., adding env vars), you must re-apply ECS and then force a new deployment to pick up the new task definition.

### Add a database migration

1. Add a new `.sql` file in `environments/local/migrations/` with the next sequence number (e.g., `005_add_column.sql`)
2. Test locally: `make db-reset` applies all migrations from scratch
3. Deploy: `make ecr-push-dev` bundles the migration into the ml-engine image, then `make aws-db-migrate` runs it

---

## Accessing the Application

| Environment | API (immediate) | Frontend (requires CloudFront) |
|-------------|-----------------|-------------------------------|
| dev | `make aws-alb-url` | `make aws-url ENV=dev` |
| test | `make aws-alb-url ENV=test` | `make aws-url ENV=test` |

CloudFront routes:
- `/` → landing site (S3)
- `/app/` → dashboard SPA (S3)
- `/api/*` → Go API (ALB)

---

## Environment Reference

| | dev | test | stable |
|---|-----|------|--------|
| Region | us-east-1 | us-east-1 | us-gov-west-1 |
| RDS instance | db.t4g.micro | db.t4g.small | db.t4g.medium |
| Multi-AZ | no | yes | yes |
| Fargate Spot | 80% | 0% | 0% |
| API CPU/RAM | 256/512 MB | 512/1024 MB | 1024/2048 MB |
| ML CPU/RAM | 512/1024 MB | 1024/2048 MB | 2048/4096 MB |
| Deletion protection | no | no | yes |
| Artifact versioning | no | yes | yes |

### Database connection (ECS)

The API and ML Engine receive database credentials as individual environment variables injected at the task level:

| Variable | Source | Notes |
|----------|--------|-------|
| `DB_HOST` | ECS env | RDS endpoint address (no port) |
| `DB_PORT` | ECS env | `5432` |
| `DB_NAME` | ECS env | `prism` |
| `DB_USER` | ECS env | `prism` (RDS master user) |
| `DB_PASSWORD` | Secrets Manager | Auto-managed by RDS, injected via `valueFrom` |

The password ARN uses JSON key extraction: `<secret-arn>:password::` extracts only the password field from the RDS-managed JSON secret.

### Secrets Manager secret format

RDS managed passwords are stored as JSON:

```json
{
  "username": "prism",
  "password": "<auto-generated>",
  "engine": "postgres",
  "host": "<rds-endpoint>",
  "port": 5432,
  "dbname": "prism"
}
```

The `:password::` suffix in the ECS `valueFrom` ARN instructs ECS to inject only the `password` field, not the full JSON.

### ECS cluster names

| Environment | Cluster |
|-------------|---------|
| dev | `prism-dev` |
| test | `prism-test` |
| stable | `prism-stable` |
