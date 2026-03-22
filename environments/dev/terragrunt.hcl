# ── PRISM — dev environment ───────────────────────────────────────────────────
# Single-AZ, minimal sizing. Used for active feature development.
# Approx. cost: ~$80/mo (Fargate spot + db.t4g.micro + single NAT gateway).

include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "${get_parent_terragrunt_dir()}/_modules//prism"
}

inputs = {
  env    = "dev"
  region = "us-east-1"

  # ── Network ────────────────────────────────────────────────────────────────
  vpc_cidr           = "10.10.0.0/16"
  availability_zones = ["us-east-1a"]       # single-AZ to minimize cost in dev
  public_subnets     = ["10.10.1.0/24"]     # presentation tier (ALB, Nginx)
  private_subnets    = ["10.10.10.0/24"]    # application tier (ECS tasks)
  restricted_subnets = ["10.10.20.0/24"]    # data tier (RDS, no internet access)
  single_nat_gateway = true                 # one NAT saves ~$30/mo vs. per-AZ

  # ── ECS Fargate ────────────────────────────────────────────────────────────
  ecs_cluster_name   = "prism-dev"
  api_desired_count  = 1
  ml_desired_count   = 1
  ui_desired_count   = 1
  site_desired_count = 1
  use_fargate_spot   = true                 # spot reduces ECS cost ~70% in dev

  # Task CPU/memory (256 CPU units = 0.25 vCPU)
  api_cpu    = 256
  api_memory = 512
  ml_cpu     = 512
  ml_memory  = 1024
  ui_cpu     = 256
  ui_memory  = 512

  # ── RDS PostgreSQL ─────────────────────────────────────────────────────────
  db_instance_class    = "db.t4g.micro"
  db_allocated_storage = 20
  db_multi_az          = false              # no HA in dev
  db_name              = "prism"
  db_deletion_protection = false

  # ── ECR ────────────────────────────────────────────────────────────────────
  ecr_image_retention_count = 5             # keep last 5 images per repo

  # ── WAF ────────────────────────────────────────────────────────────────────
  enable_waf          = true
  waf_rate_limit      = 2000               # req/5min per IP

  # ── Artifact Storage (S3, replaces Docker volume) ─────────────────────────
  artifact_bucket_versioning = false        # no versioning needed in dev
}
