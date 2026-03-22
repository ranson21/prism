locals {
  env    = "test"
  region = "us-east-1"

  # Network — multi-AZ, mirrors stable
  vpc_cidr           = "10.20.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]
  public_subnets     = ["10.20.1.0/24", "10.20.2.0/24"]
  private_subnets    = ["10.20.10.0/24", "10.20.11.0/24"]
  restricted_subnets = ["10.20.20.0/24", "10.20.21.0/24"]
  single_nat_gateway = false

  # RDS
  db_instance_class      = "db.t4g.small"
  db_allocated_storage   = 50
  db_multi_az            = true
  db_deletion_protection = false

  # ECS
  api_cpu    = 512
  api_memory = 1024
  ml_cpu     = 1024
  ml_memory  = 2048
  ui_cpu     = 256
  ui_memory  = 512
  use_fargate_spot = false

  # WAF
  waf_rate_limit = 1000

  # S3
  artifact_bucket_versioning = true
}
