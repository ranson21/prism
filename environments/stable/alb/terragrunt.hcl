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
    public_subnets = ["subnet-00000001", "subnet-00000002", "subnet-00000003"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "sg" {
  config_path = "../sg"
  mock_outputs = {
    alb_sg_id = "sg-00000001"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

terraform {
  source = "tfr:///terraform-aws-modules/alb/aws?version=8.7.0"
}

inputs = {
  name            = "prism-${local.env.env}"
  vpc_id          = dependency.vpc.outputs.vpc_id
  subnets         = dependency.vpc.outputs.public_subnets
  security_groups = [dependency.sg.outputs.alb_sg_id]

  http_tcp_listeners = [
    {
      port               = 80
      protocol           = "HTTP"
      action_type        = "forward"
      target_group_index = 0
    }
  ]

  target_groups = [
    {
      name             = "prism-${local.env.env}-api"
      backend_protocol = "HTTP"
      backend_port     = 8080
      target_type      = "ip"
      health_check = {
        enabled = true
        path    = "/health"
      }
    }
  ]
}
