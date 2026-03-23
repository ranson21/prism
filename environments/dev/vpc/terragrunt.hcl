include "root" {
  path = find_in_parent_folders()
}

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env      = local.env_vars.locals
}

terraform {
  source = "tfr:///terraform-aws-modules/vpc/aws?version=5.8.1"
}

inputs = {
  name = "prism-${local.env.env}"
  cidr = local.env.vpc_cidr

  azs              = local.env.availability_zones
  public_subnets   = local.env.public_subnets
  private_subnets  = local.env.private_subnets
  database_subnets = local.env.restricted_subnets

  enable_nat_gateway   = true
  single_nat_gateway   = local.env.single_nat_gateway
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Tag subnets for ECS and ALB auto-discovery
  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
    Tier                     = "presentation"
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
    Tier                              = "application"
  }
  database_subnet_tags = {
    Tier = "data"
  }
}
