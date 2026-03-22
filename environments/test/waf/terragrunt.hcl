include "root" {
  path = find_in_parent_folders()
}

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env      = local.env_vars.locals
}

dependency "alb" {
  config_path = "../alb"
  mock_outputs = {
    lb_arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/prism-test/abc123"
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
    variable "alb_arn" { type = string }

    resource "aws_wafv2_web_acl" "this" {
      name  = "prism-${local.env.env}-waf"
      scope = "REGIONAL"

      default_action {
        allow {
        }
      }

      rule {
        name     = "AWSManagedRulesCommonRuleSet"
        priority = 10
        override_action {
          none {
          }
        }
        statement {
          managed_rule_group_statement {
            name        = "AWSManagedRulesCommonRuleSet"
            vendor_name = "AWS"
          }
        }
        visibility_config {
          cloudwatch_metrics_enabled = true
          metric_name                = "CommonRuleSet"
          sampled_requests_enabled   = true
        }
      }

      rule {
        name     = "AWSManagedRulesKnownBadInputsRuleSet"
        priority = 20
        override_action {
          none {
          }
        }
        statement {
          managed_rule_group_statement {
            name        = "AWSManagedRulesKnownBadInputsRuleSet"
            vendor_name = "AWS"
          }
        }
        visibility_config {
          cloudwatch_metrics_enabled = true
          metric_name                = "KnownBadInputs"
          sampled_requests_enabled   = true
        }
      }

      rule {
        name     = "AWSManagedRulesAmazonIpReputationList"
        priority = 30
        override_action {
          none {
          }
        }
        statement {
          managed_rule_group_statement {
            name        = "AWSManagedRulesAmazonIpReputationList"
            vendor_name = "AWS"
          }
        }
        visibility_config {
          cloudwatch_metrics_enabled = true
          metric_name                = "IpReputationList"
          sampled_requests_enabled   = true
        }
      }

      rule {
        name     = "RateLimitPerIP"
        priority = 40
        action {
          block {
          }
        }
        statement {
          rate_based_statement {
            limit              = ${local.env.waf_rate_limit}
            aggregate_key_type = "IP"
          }
        }
        visibility_config {
          cloudwatch_metrics_enabled = true
          metric_name                = "RateLimitPerIP"
          sampled_requests_enabled   = true
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "prism-${local.env.env}-waf"
        sampled_requests_enabled   = true
      }
    }

    resource "aws_wafv2_web_acl_association" "this" {
      resource_arn = var.alb_arn
      web_acl_arn  = aws_wafv2_web_acl.this.arn
    }

    output "web_acl_arn" {
      value = aws_wafv2_web_acl.this.arn
    }
  TFEOF
}

inputs = {
  alb_arn = dependency.alb.outputs.lb_arn
}
