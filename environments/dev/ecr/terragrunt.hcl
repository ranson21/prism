include "root" {
  path = find_in_parent_folders()
}

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env      = local.env_vars.locals
}

terraform {
  source = "."
}

generate "main" {
  path      = "main.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-TFEOF
    locals {
      keep_count = ${local.env.env == "dev" ? 5 : 10}
      repos = ["api", "ml-engine", "ui", "site"]
    }

    resource "aws_ecr_repository" "this" {
      for_each             = toset(local.repos)
      name                 = "prism-${local.env.env}-$${each.key}"
      image_tag_mutability = "MUTABLE"

      image_scanning_configuration {
        scan_on_push = true
      }
    }

    resource "aws_ecr_lifecycle_policy" "this" {
      for_each   = aws_ecr_repository.this
      repository = each.value.name

      policy = jsonencode({
        rules = [{
          rulePriority = 1
          description  = "Keep last $${local.keep_count} images"
          selection = {
            tagStatus   = "any"
            countType   = "imageCountMoreThan"
            countNumber = local.keep_count
          }
          action = { type = "expire" }
        }]
      })
    }

    output "repository_urls" {
      value = { for k, v in aws_ecr_repository.this : k => v.repository_url }
    }
  TFEOF
}
