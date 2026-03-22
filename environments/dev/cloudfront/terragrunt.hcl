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
    lb_dns_name = "prism-dev-123456789.us-east-1.elb.amazonaws.com"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

# Inline CloudFront distribution — avoids module interface churn across versions
terraform {
  source = "."
}

generate "main" {
  path      = "main.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-TFEOF
    variable "alb_dns_name" { type = string }

    resource "aws_cloudfront_distribution" "this" {
      enabled             = true
      is_ipv6_enabled     = true
      comment             = "PRISM ${local.env.env}"
      price_class         = "PriceClass_100"
      wait_for_deployment = false

      origin {
        origin_id   = "alb"
        domain_name = var.alb_dns_name

        custom_origin_config {
          http_port              = 80
          https_port             = 443
          origin_protocol_policy = "http-only"
          origin_ssl_protocols   = ["TLSv1.2"]
        }
      }

      # /api/* — no caching, all headers forwarded to ALB
      ordered_cache_behavior {
        path_pattern     = "/api/*"
        target_origin_id = "alb"
        allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
        cached_methods   = ["GET", "HEAD"]
        compress         = true

        forwarded_values {
          query_string = true
          headers      = ["*"]
          cookies {
            forward = "all"
          }
        }

        viewer_protocol_policy = "redirect-to-https"
        min_ttl                = 0
        default_ttl            = 0
        max_ttl                = 0
      }

      # Default: serve UI — pass necessary headers, no aggressive caching
      default_cache_behavior {
        target_origin_id = "alb"
        allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
        cached_methods   = ["GET", "HEAD"]
        compress         = true

        forwarded_values {
          query_string = true
          headers      = ["Host", "Origin", "Authorization", "Accept", "Content-Type"]
          cookies {
            forward = "all"
          }
        }

        viewer_protocol_policy = "redirect-to-https"
        min_ttl                = 0
        default_ttl            = 0
        max_ttl                = 0
      }

      restrictions {
        geo_restriction {
          restriction_type = "none"
        }
      }

      # Uses *.cloudfront.net certificate — no custom domain or ACM cert required
      viewer_certificate {
        cloudfront_default_certificate = true
      }
    }

    output "cloudfront_domain_name" {
      value       = aws_cloudfront_distribution.this.domain_name
      description = "Share this HTTPS URL with your team: https://<value>"
    }

    output "cloudfront_distribution_id" {
      value = aws_cloudfront_distribution.this.id
    }
  TFEOF
}

inputs = {
  alb_dns_name = dependency.alb.outputs.lb_dns_name
}
