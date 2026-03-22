include "root" {
  path = find_in_parent_folders()
}

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env      = local.env_vars.locals
}

# One ECR repository per service — each service is its own module call.
# Terragrunt's for_each equivalent: use generate blocks or separate folders per repo.
# Here we create all four repos in one config for brevity.

terraform {
  source = "tfr:///terraform-aws-modules/ecr/aws?version=2.3.0"
}

# Module is called once per repo — use multiple includes or a wrapper.
# For a single apply, wire each repo as a named resource below.
inputs = {
  repository_name      = "prism-${local.env.env}-api"
  repository_type      = "private"
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
