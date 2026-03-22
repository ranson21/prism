include "root" {
  path = find_in_parent_folders()
}

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env      = local.env_vars.locals
}

terraform {
  source = "tfr:///terraform-aws-modules/ecr/aws?version=2.3.0"
}

inputs = {
  repository_name = "prism-${local.env.env}-api"
  repository_type = "private"
  repository_lifecycle_policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last ${local.env.env == "dev" ? 5 : 10} images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = local.env.env == "dev" ? 5 : 10
      }
      action = { type = "expire" }
    }]
  })
  repository_image_scan_on_push = true
}
