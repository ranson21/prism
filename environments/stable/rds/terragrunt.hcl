include "root" {
  path = find_in_parent_folders()
}

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env      = local.env_vars.locals
}

dependency "vpc" {
  config_path = "../vpc"
  mock_outputs = {
    vpc_id                     = "vpc-00000000"
    database_subnets           = ["subnet-00000001", "subnet-00000002", "subnet-00000003"]
    database_subnet_group_name = "prism-stable-db-subnet-group"
    default_security_group_id  = "sg-00000000"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

terraform {
  source = "tfr:///terraform-aws-modules/rds/aws?version=6.7.0"
}

inputs = {
  identifier = "prism-${local.env.env}"

  engine               = "postgres"
  engine_version       = "16"
  family               = "postgres16"
  major_engine_version = "16"
  instance_class       = local.env.db_instance_class

  allocated_storage     = local.env.db_allocated_storage
  max_allocated_storage = local.env.db_allocated_storage * 2

  db_name  = "prism"
  username = "prism"
  port     = 5432

  multi_az               = local.env.db_multi_az
  db_subnet_group_name   = dependency.vpc.outputs.database_subnet_group_name
  vpc_security_group_ids = [dependency.vpc.outputs.default_security_group_id]

  # Backups
  backup_retention_period = local.env.env == "stable" ? 30 : 7
  backup_window           = "03:00-06:00"
  maintenance_window      = "Mon:00:00-Mon:03:00"

  deletion_protection = local.env.db_deletion_protection

  # Encryption at rest (required for FedRAMP)
  storage_encrypted = true

  # Enhanced monitoring (enabled in stable for operational visibility)
  monitoring_interval    = local.env.env == "stable" ? 60 : 0
  create_monitoring_role = local.env.env == "stable"
}
