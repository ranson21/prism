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
    lb_dns_name = "prism-test-123456789.us-east-1.elb.amazonaws.com"
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
    variable "alb_dns_name" { type = string }

    data "aws_caller_identity" "current" {}

    # ── Static assets bucket ─────────────────────────────────────────────────
    resource "aws_s3_bucket" "static" {
      bucket        = "prism-${local.env.env}-static-$${data.aws_caller_identity.current.account_id}"
      force_destroy = true
    }

    resource "aws_s3_bucket_public_access_block" "static" {
      bucket                  = aws_s3_bucket.static.id
      block_public_acls       = true
      block_public_policy     = true
      ignore_public_acls      = true
      restrict_public_buckets = true
    }

    # ── CloudFront Origin Access Control ─────────────────────────────────────
    resource "aws_cloudfront_origin_access_control" "static" {
      name                              = "prism-${local.env.env}-static-oac"
      origin_access_control_origin_type = "s3"
      signing_behavior                  = "always"
      signing_protocol                  = "sigv4"
    }

    # Allow CloudFront to read from the static bucket
    resource "aws_s3_bucket_policy" "static" {
      bucket = aws_s3_bucket.static.id
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [{
          Sid       = "AllowCloudFrontRead"
          Effect    = "Allow"
          Principal = { Service = "cloudfront.amazonaws.com" }
          Action    = "s3:GetObject"
          Resource  = "$${aws_s3_bucket.static.arn}/*"
          Condition = {
            StringEquals = {
              "AWS:SourceArn" = aws_cloudfront_distribution.this.arn
            }
          }
        }]
      })
    }

    # ── CloudFront distribution ───────────────────────────────────────────────
    resource "aws_cloudfront_distribution" "this" {
      enabled             = true
      is_ipv6_enabled     = true
      comment             = "PRISM ${local.env.env}"
      price_class         = "PriceClass_100"
      default_root_object = "index.html"
      wait_for_deployment = false

      # Origin 1: S3 static bucket (site + UI)
      origin {
        origin_id                = "s3-static"
        domain_name              = aws_s3_bucket.static.bucket_regional_domain_name
        origin_access_control_id = aws_cloudfront_origin_access_control.static.id
      }

      # Origin 2: ALB (API only)
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

      # /api/* — no caching, all methods forwarded to ALB
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

      # Default: S3 static (serves site at root, UI under /app/)
      default_cache_behavior {
        target_origin_id = "s3-static"
        allowed_methods  = ["GET", "HEAD", "OPTIONS"]
        cached_methods   = ["GET", "HEAD"]
        compress         = true

        forwarded_values {
          query_string = false
          cookies {
            forward = "none"
          }
        }

        viewer_protocol_policy = "redirect-to-https"
        min_ttl                = 0
        default_ttl            = 86400
        max_ttl                = 31536000
      }

      # SPA fallback: serve /app/index.html for unknown /app/* paths (React Router)
      custom_error_response {
        error_code            = 403
        response_code         = 200
        response_page_path    = "/app/index.html"
        error_caching_min_ttl = 0
      }
      custom_error_response {
        error_code            = 404
        response_code         = 200
        response_page_path    = "/app/index.html"
        error_caching_min_ttl = 0
      }

      restrictions {
        geo_restriction {
          restriction_type = "none"
        }
      }

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

    output "static_bucket_name" {
      value = aws_s3_bucket.static.id
    }
  TFEOF
}

inputs = {
  alb_dns_name = dependency.alb.outputs.lb_dns_name
}
