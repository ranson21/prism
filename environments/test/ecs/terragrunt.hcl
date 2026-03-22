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
    vpc_id          = "vpc-00000000"
    private_subnets = ["subnet-00000001"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "alb" {
  config_path = "../alb"
  mock_outputs = {
    target_group_arns = [
      "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/prism-test-site/aaa",
      "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/prism-test-api/bbb",
      "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/prism-test-ui/ccc",
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
    db_instance_endpoint               = "prism-test.abc123.us-east-1.rds.amazonaws.com"
    db_instance_port                   = 5432
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

      container_definitions = {
        api = {
          image     = "119004746646.dkr.ecr.${local.env.region}.amazonaws.com/prism-${local.env.env}-api:latest"
          essential = true
          port_mappings = [{ containerPort = 8080, protocol = "tcp" }]
          environment = [
            { name = "DATABASE_URL", value = "postgresql://prism@${dependency.rds.outputs.db_instance_endpoint}:5432/prism" }
          ]
          secrets = [
            { name = "DB_PASSWORD", valueFrom = dependency.rds.outputs.db_instance_master_user_secret_arn }
          ]
        }
      }

      subnet_ids         = dependency.vpc.outputs.private_subnets
      security_group_ids = [dependency.sg.outputs.ecs_sg_id]
      load_balancer = {
        service = {
          target_group_arn = dependency.alb.outputs.target_group_arns[1]
          container_name   = "api"
          container_port   = 8080
        }
      }
    }

    # ── Python ML Engine ─────────────────────────────────────────────────────
    ml-engine = {
      cpu    = local.env.ml_cpu
      memory = local.env.ml_memory

      container_definitions = {
        ml-engine = {
          image     = "119004746646.dkr.ecr.${local.env.region}.amazonaws.com/prism-${local.env.env}-ml-engine:latest"
          essential = true
          port_mappings = [{ containerPort = 8001, protocol = "tcp" }]
          environment = [
            { name = "DATABASE_URL",      value = "postgresql://prism@${dependency.rds.outputs.db_instance_endpoint}:5432/prism" },
            { name = "ARTIFACT_S3_BUCKET", value = dependency.s3.outputs.s3_bucket_id }
          ]
          secrets = [
            { name = "DB_PASSWORD", valueFrom = dependency.rds.outputs.db_instance_master_user_secret_arn }
          ]
        }
      }

      subnet_ids         = dependency.vpc.outputs.private_subnets
      security_group_ids = [dependency.sg.outputs.ecs_sg_id]
    }

    # ── React UI ─────────────────────────────────────────────────────────────
    ui = {
      cpu    = local.env.ui_cpu
      memory = local.env.ui_memory

      container_definitions = {
        ui = {
          image     = "119004746646.dkr.ecr.${local.env.region}.amazonaws.com/prism-${local.env.env}-ui:latest"
          essential = true
          port_mappings = [{ containerPort = 3000, protocol = "tcp" }]
        }
      }

      subnet_ids = dependency.vpc.outputs.private_subnets
      load_balancer = {
        service = {
          target_group_arn = dependency.alb.outputs.target_group_arns[2] # ui
          container_name   = "ui"
          container_port   = 3000
        }
      }
    }

    # ── Landing Site ──────────────────────────────────────────────────────────
    site = {
      cpu    = local.env.ui_cpu
      memory = local.env.ui_memory

      container_definitions = {
        site = {
          image     = "119004746646.dkr.ecr.${local.env.region}.amazonaws.com/prism-${local.env.env}-site:latest"
          essential = true
          port_mappings = [{ containerPort = 80, protocol = "tcp" }]
        }
      }

      subnet_ids         = dependency.vpc.outputs.private_subnets
      security_group_ids = [dependency.sg.outputs.ecs_sg_id]
      load_balancer = {
        service = {
          target_group_arn = dependency.alb.outputs.target_group_arns[0] # site
          container_name   = "site"
          container_port   = 80
        }
      }
    }
  }
}
