include "root" {
  path = find_in_parent_folders()
}

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env      = local.env_vars.locals
}

terraform {
  source = "tfr:///terraform-aws-modules/s3-bucket/aws?version=4.1.2"
}

inputs = {
  bucket = "prism-${local.env.env}-ml-artifacts"

  # Block all public access — artifacts are internal only
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

  versioning = {
    enabled = local.env.artifact_bucket_versioning
  }

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "aws:kms"
      }
    }
  }

  lifecycle_rule = [
    {
      id      = "expire-old-artifacts"
      enabled = true
      noncurrent_version_expiration = {
        days = 30
      }
    }
  ]
}
