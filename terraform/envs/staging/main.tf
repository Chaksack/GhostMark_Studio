locals {
  common_tags = {
    Environment = var.env
    Project     = var.project
    ManagedBy   = "Terraform"
  }
}

module "vpc" {
  source               = "../../modules/vpc"
  name                 = "${var.project}-${var.env}"
  cidr_block           = var.vpc_cidr
  azs                  = var.azs
  public_subnet_cidrs  = var.public_subnet_cidrs
  region               = var.aws_region
  tags                 = local.common_tags
}

module "ecr" {
  source        = "../../modules/ecr"
  name_prefix   = "${var.project}-${var.env}"
  repositories  = ["backend", "storefront"]
  tags          = local.common_tags
}

module "uploads" {
  source = "../../modules/s3"
  name   = var.upload_bucket_name
  tags   = local.common_tags
  cors_rules = var.allowed_origins == null ? null : [
    {
      allowed_methods = ["GET", "PUT", "POST", "HEAD"]
      allowed_origins = var.allowed_origins
      allowed_headers = ["*"]
    }
  ]
}

module "cdn" {
  source             = "../../modules/cloudfront"
  name               = "${var.project}-${var.env}-uploads-cdn"
  bucket_domain_name = "${module.uploads.bucket_name}.s3.amazonaws.com"
  bucket_arn         = module.uploads.bucket_arn
  tags               = local.common_tags
}

module "ecs" {
  source            = "../../modules/ecs"
  name              = "${var.project}-${var.env}"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  tags              = local.common_tags
  acm_certificate_arn = var.acm_certificate_arn
  health_check_path   = var.health_check_path
  health_check_matcher = var.health_check_matcher
}

# Optional Monitoring stack (Prometheus + Alertmanager + CloudWatch Exporter)
module "monitoring" {
  count  = var.monitoring_enabled ? 1 : 0
  source = "../../modules/monitoring-ecs"
  name   = "${var.project}-${var.env}"

  cluster_arn        = module.ecs.cluster_arn
  subnet_ids         = module.vpc.public_subnet_ids
  security_group_ids = [module.ecs.tasks_security_group_id]
  tags               = local.common_tags

  aws_region        = var.aws_region
  desired_count     = var.monitoring_desired_count
  scrape_interval   = var.monitoring_scrape_interval
  thresholds        = var.monitoring_thresholds

  alertmanager_slack_webhook_url = var.alertmanager_slack_webhook_url
  alertmanager_channel           = var.alertmanager_channel
  alertmanager_username          = var.alertmanager_username
}

module "rds" {
  source                   = "../../modules/rds"
  count                    = var.rds_enabled ? 1 : 0
  name                     = "${var.project}-${var.env}-db"
  vpc_id                   = module.vpc.vpc_id
  public_subnet_ids        = module.vpc.public_subnet_ids
  tasks_security_group_id  = module.ecs.tasks_security_group_id

  engine                   = var.rds_engine
  engine_version           = var.rds_engine_version
  instance_class           = var.rds_instance_class
  allocated_storage        = var.rds_allocated_storage
  db_name                  = var.rds_db_name
  master_username          = var.rds_master_username
  master_password          = var.rds_master_password
  multi_az                 = var.rds_multi_az
  backup_retention         = var.rds_backup_retention
  deletion_protection      = var.rds_deletion_protection
  apply_immediately        = false
  tags                     = local.common_tags
}

module "dns" {
  source          = "../../modules/route53"
  count           = var.route53_enabled ? 1 : 0
  hosted_zone_id  = var.route53_hosted_zone_id
  record_name     = var.route53_domain_name
  alb_dns_name    = module.ecs.alb_dns_name
  alb_zone_id     = module.ecs.alb_zone_id
}

output "vpc_id" { value = module.vpc.vpc_id }
output "public_subnet_ids" { value = module.vpc.public_subnet_ids }
output "ecr_repos" { value = module.ecr.repository_urls }
output "uploads_bucket" { value = module.uploads.bucket_name }
output "cdn_domain" { value = module.cdn.distribution_domain }
output "alb_dns" { value = module.ecs.alb_dns_name }
output "dns_fqdn" { value = var.route53_enabled ? module.dns[0].fqdn : "" }
output "rds_endpoint" { value = var.rds_enabled ? module.rds[0].db_endpoint : "" }
output "rds_port" { value = var.rds_enabled ? module.rds[0].db_port : 0 }
