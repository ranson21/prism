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
    vpc_id = "vpc-00000000"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

terraform {
  source = "."
}

generate "main" {
  path      = "main.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-TFEOF
    variable "vpc_id" { type = string }

    resource "aws_security_group" "alb" {
      name        = "prism-${local.env.env}-alb"
      description = "ALB: inbound HTTP from internet (CloudFront handles TLS)"
      vpc_id      = var.vpc_id

      ingress {
        description = "HTTP from internet"
        from_port   = 80
        to_port     = 80
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
      }
      egress {
        from_port   = 0
        to_port     = 0
        protocol    = "-1"
        cidr_blocks = ["0.0.0.0/0"]
      }

      tags = { Name = "prism-${local.env.env}-alb" }
    }

    resource "aws_security_group" "ecs" {
      name        = "prism-${local.env.env}-ecs"
      description = "ECS Fargate tasks: inbound from ALB only"
      vpc_id      = var.vpc_id

      ingress {
        description     = "API"
        from_port       = 8080
        to_port         = 8080
        protocol        = "tcp"
        security_groups = [aws_security_group.alb.id]
      }
      ingress {
        description     = "ML Engine (internal)"
        from_port       = 8001
        to_port         = 8001
        protocol        = "tcp"
        security_groups = [aws_security_group.alb.id]
      }
      egress {
        from_port   = 0
        to_port     = 0
        protocol    = "-1"
        cidr_blocks = ["0.0.0.0/0"]
      }

      tags = { Name = "prism-${local.env.env}-ecs" }
    }

    resource "aws_security_group" "rds" {
      name        = "prism-${local.env.env}-rds"
      description = "RDS PostgreSQL: inbound from ECS tasks only"
      vpc_id      = var.vpc_id

      ingress {
        description     = "PostgreSQL from ECS"
        from_port       = 5432
        to_port         = 5432
        protocol        = "tcp"
        security_groups = [aws_security_group.ecs.id]
      }
      egress {
        from_port   = 0
        to_port     = 0
        protocol    = "-1"
        cidr_blocks = ["0.0.0.0/0"]
      }

      tags = { Name = "prism-${local.env.env}-rds" }
    }

    output "alb_sg_id" { value = aws_security_group.alb.id }
    output "ecs_sg_id" { value = aws_security_group.ecs.id }
    output "rds_sg_id" { value = aws_security_group.rds.id }
  TFEOF
}

inputs = {
  vpc_id = dependency.vpc.outputs.vpc_id
}
