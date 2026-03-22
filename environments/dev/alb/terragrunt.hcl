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
    vpc_id         = "vpc-00000000"
    public_subnets = ["subnet-00000001", "subnet-00000002"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

terraform {
  source = "tfr:///terraform-aws-modules/alb/aws?version=9.9.0"
}

inputs = {
  name    = "prism-${local.env.env}"
  vpc_id  = dependency.vpc.outputs.vpc_id
  subnets = dependency.vpc.outputs.public_subnets

  # HTTPS only — redirect HTTP → HTTPS
  listeners = {
    https = {
      port            = 443
      protocol        = "HTTPS"
      certificate_arn = "" # set via ACM after cert provisioning
      forward = {
        target_group_key = "ui"
      }
    }
    http_redirect = {
      port     = 80
      protocol = "HTTP"
      redirect = {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  target_groups = {
    ui = {
      name             = "prism-${local.env.env}-ui"
      protocol         = "HTTP"
      port             = 80
      target_type      = "ip"    # Fargate uses IP targets
      health_check = {
        enabled             = true
        path                = "/health"
        healthy_threshold   = 2
        unhealthy_threshold = 3
      }
    }
    api = {
      name        = "prism-${local.env.env}-api"
      protocol    = "HTTP"
      port        = 8080
      target_type = "ip"
      health_check = {
        enabled = true
        path    = "/health"
      }
    }
  }
}
