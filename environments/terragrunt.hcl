locals {
  owner       = "sky-solutions"
  project     = "prism"
  domain      = get_env("DOMAIN", "prism.skysolns.io")

  # State backend — S3 bucket and DynamoDB lock table must exist before first apply.
  # For GovCloud: set AWS_DEFAULT_REGION=us-gov-west-1 and STATE_BUCKET accordingly.
  state_bucket      = get_env("TF_STATE_BUCKET", "prism-terraform-state")
  state_lock_table  = get_env("TF_LOCK_TABLE",   "prism-terraform-locks")
  region            = get_env("AWS_DEFAULT_REGION", "us-east-1")

  # Resolve module source: local path during development, git ref in CI.
  use_local_modules = get_env("TF_LOCAL", "false") == "true"
  module_source     = local.use_local_modules ? "${get_parent_terragrunt_dir()}/_modules" : "git::https://github.com/sky-solutions/prism-infra.git//modules"

  # Environment name derived from the directory path (dev / test / stable).
  env = basename(get_terragrunt_dir())
}

# ── Remote State (S3 + DynamoDB) ──────────────────────────────────────────────
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite"
  }
  config = {
    bucket         = local.state_bucket
    key            = "${local.project}/${local.env}/${path_relative_to_include()}/terraform.tfstate"
    region         = local.region
    encrypt        = true
    dynamodb_table = local.state_lock_table
  }
}

# ── AWS Provider ──────────────────────────────────────────────────────────────
generate "provider" {
  path      = "provider_override.tf"
  if_exists = "overwrite"
  contents  = <<EOF
# Terragrunt Generated Provider Block
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

provider "aws" {
  region = "${local.region}"

  default_tags {
    tags = {
      Project     = "${local.project}"
      Environment = "${local.env}"
      Owner       = "${local.owner}"
      ManagedBy   = "terragrunt"
    }
  }
}
EOF
}
