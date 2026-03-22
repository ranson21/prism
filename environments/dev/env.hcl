locals {
  env    = "dev"
  region = "us-east-1"

  # Network — single-AZ, cost-optimised
  vpc_cidr           = "10.10.0.0/16"
  availability_zones = ["us-east-1a"]
  public_subnets     = ["10.10.1.0/24"]
  private_subnets    = ["10.10.10.0/24"]
  restricted_subnets = ["10.10.20.0/24"]
  single_nat_gateway = true

  # RDS
  db_instance_class      = "db.t4g.micro"
  db_allocated_storage   = 20
  db_multi_az            = false
  db_deletion_protection = false

  # ECS task sizing (CPU units / MiB)
  api_cpu    = 256
  api_memory = 512
  ml_cpu     = 512
  ml_memory  = 1024
  ui_cpu     = 256
  ui_memory  = 512
  use_fargate_spot = true

  # WAF
  waf_rate_limit = 2000

  # S3
  artifact_bucket_versioning = false
}
