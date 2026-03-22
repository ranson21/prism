locals {
  env    = "stable"
  region = "us-gov-west-1"   # GovCloud for FedRAMP Moderate alignment

  # Network — multi-AZ, full HA
  vpc_cidr           = "10.30.0.0/16"
  availability_zones = ["us-gov-west-1a", "us-gov-west-1b", "us-gov-west-1c"]
  public_subnets     = ["10.30.1.0/24", "10.30.2.0/24", "10.30.3.0/24"]
  private_subnets    = ["10.30.10.0/24", "10.30.11.0/24", "10.30.12.0/24"]
  restricted_subnets = ["10.30.20.0/24", "10.30.21.0/24", "10.30.22.0/24"]
  single_nat_gateway = false

  # RDS
  db_instance_class      = "db.t4g.medium"
  db_allocated_storage   = 100
  db_multi_az            = true
  db_deletion_protection = true

  # ECS
  api_cpu    = 1024
  api_memory = 2048
  ml_cpu     = 2048
  ml_memory  = 4096
  ui_cpu     = 512
  ui_memory  = 1024
  use_fargate_spot = false

  # WAF
  waf_rate_limit = 500

  # S3
  artifact_bucket_versioning = true
}
