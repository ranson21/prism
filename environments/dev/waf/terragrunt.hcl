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
    lb_arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/prism-dev/abc123"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

terraform {
  source = "tfr:///umotif-public/waf-webaclv2/aws?version=3.9.0"
}

inputs = {
  name_prefix = "prism-${local.env.env}"
  scope       = "REGIONAL"
  alb_arn     = dependency.alb.outputs.lb_arn

  # AWS Managed Rule Groups — covers OWASP Top 10, known bad inputs, IP reputation
  managed_rules = [
    {
      name            = "AWSManagedRulesCommonRuleSet"
      priority        = 10
      override_action = "none"
      excluded_rules  = []
    },
    {
      name            = "AWSManagedRulesKnownBadInputsRuleSet"
      priority        = 20
      override_action = "none"
      excluded_rules  = []
    },
    {
      name            = "AWSManagedRulesAmazonIpReputationList"
      priority        = 30
      override_action = "none"
      excluded_rules  = []
    },
  ]

  # Rate limiting — throttle aggressive clients per IP
  rate_based_rules = [
    {
      name     = "RateLimitPerIP"
      priority = 40
      action   = "block"
      limit    = local.env.waf_rate_limit
    }
  ]

  # CloudWatch metrics for WAF visibility
  enable_cloudwatch_metrics = true
  cloudwatch_metrics_name   = "prism-${local.env.env}-waf"
}
