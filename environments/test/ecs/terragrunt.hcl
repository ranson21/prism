include "root" {
  path = find_in_parent_folders()
}

locals {
  env_vars   = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env        = local.env_vars.locals
  account_id = get_aws_account_id()
}

dependency "vpc" {
  config_path = "../vpc"
  mock_outputs = {
    vpc_id          = "vpc-00000000"
    private_subnets = ["subnet-00000001"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "alb" {
  config_path = "../alb"
  mock_outputs = {
    target_group_arns = [
      "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/prism-test-api/aaa",
    ]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "sg" {
  config_path = "../sg"
  mock_outputs = {
    ecs_sg_id = "sg-00000002"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "rds" {
  config_path = "../rds"
  mock_outputs = {
    db_instance_address                = "prism-test.abc123.us-east-1.rds.amazonaws.com"
    db_instance_master_user_secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:rds!db-prism-test-mock"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "s3" {
  config_path = "../s3"
  mock_outputs = {
    s3_bucket_id = "prism-test-ml-artifacts"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

terraform {
  source = "tfr:///terraform-aws-modules/ecs/aws?version=5.11.4"
}

inputs = {
  cluster_name = "prism-${local.env.env}"

  cluster_settings = {
    name  = "containerInsights"
    value = "enabled"
  }

  fargate_capacity_providers = {
    FARGATE = {
      default_capacity_provider_strategy = {
        weight = local.env.use_fargate_spot ? 20 : 100
      }
    }
    FARGATE_SPOT = {
      default_capacity_provider_strategy = {
        weight = local.env.use_fargate_spot ? 80 : 0
      }
    }
  }

  services = {
    # ── Go REST API ──────────────────────────────────────────────────────────
    api = {
      cpu    = local.env.api_cpu
      memory = local.env.api_memory
      enable_execute_command = true

      container_definitions = {
        api = {
          image     = "${local.account_id}.dkr.ecr.${local.env.region}.amazonaws.com/prism-${local.env.env}-api:latest"
          essential = true
          port_mappings = [{ containerPort = 8080, protocol = "tcp" }]
          environment = [
            { name = "DATABASE_URL", value = "postgresql://prism@${dependency.rds.outputs.db_instance_address}:5432/prism" }
          ]
          secrets = [
            { name = "DB_PASSWORD", valueFrom = "${dependency.rds.outputs.db_instance_master_user_secret_arn}:password::" }
          ]
        }
      }

      subnet_ids         = dependency.vpc.outputs.private_subnets
      security_group_ids = [dependency.sg.outputs.ecs_sg_id]
      load_balancer = {
        service = {
          target_group_arn = dependency.alb.outputs.target_group_arns[0]
          container_name   = "api"
          container_port   = 8080
        }
      }
    }

    # ── Python ML Engine ─────────────────────────────────────────────────────
    ml-engine = {
      cpu    = local.env.ml_cpu
      memory = local.env.ml_memory
      enable_execute_command = true

      container_definitions = {
        ml-engine = {
          image     = "${local.account_id}.dkr.ecr.${local.env.region}.amazonaws.com/prism-${local.env.env}-ml-engine:latest"
          essential = true
          port_mappings = [{ containerPort = 8001, protocol = "tcp" }]
          environment = [
            { name = "DATABASE_URL",      value = "postgresql://prism@${dependency.rds.outputs.db_instance_address}:5432/prism" },
            { name = "ARTIFACT_S3_BUCKET", value = dependency.s3.outputs.s3_bucket_id }
          ]
          secrets = [
            { name = "DB_PASSWORD", valueFrom = "${dependency.rds.outputs.db_instance_master_user_secret_arn}:password::" }
          ]
          readonly_root_filesystem = false
        }
      }

      subnet_ids         = dependency.vpc.outputs.private_subnets
      security_group_ids = [dependency.sg.outputs.ecs_sg_id]
    }
  }
}
