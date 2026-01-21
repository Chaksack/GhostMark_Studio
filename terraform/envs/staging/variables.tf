variable "env" { type = string description = "Environment name, e.g., staging" }
variable "project" { type = string description = "Project name/prefix for resources" }
variable "aws_region" { type = string default = "eu-west-2" description = "AWS region" }

variable "vpc_cidr" { type = string default = "10.10.0.0/16" description = "CIDR block for the VPC" }
variable "public_subnet_cidrs" { type = list(string) default = ["10.10.1.0/24", "10.10.2.0/24"] description = "CIDRs for public subnets (ALB)" }
variable "azs" { type = list(string) default = ["eu-west-2a", "eu-west-2b"] description = "Availability Zones used" }

variable "upload_bucket_name" { type = string description = "Name of the S3 bucket for uploads" }

# CORS for uploads bucket
variable "allowed_origins" { type = list(string) default = ["*"] description = "Allowed CORS origins for the uploads bucket; use specific domains in prod" }

# Optional Route53 DNS for ALB
variable "route53_enabled" { type = bool default = false description = "Whether to create Route53 record to ALB" }
variable "route53_hosted_zone_id" { type = string default = "" description = "Hosted zone ID for the domain" }
variable "route53_domain_name" { type = string default = "" description = "Record name to point to ALB" }

# ALB/HTTPS
variable "acm_certificate_arn" { type = string default = null description = "ACM certificate ARN for HTTPS on ALB" }
variable "health_check_path" { type = string default = "/" description = "ALB target group health check path" }
variable "health_check_matcher" { type = string default = "200-399" description = "ALB target group health check matcher" }

# Optional RDS
variable "rds_enabled" { type = bool default = false description = "Whether to create RDS instance" }
variable "rds_engine" { type = string default = "postgres" description = "RDS engine" }
variable "rds_engine_version" { type = string default = "14" description = "RDS engine version" }
variable "rds_instance_class" { type = string default = "db.t4g.micro" description = "RDS instance class" }
variable "rds_allocated_storage" { type = number default = 20 description = "Allocated storage (GiB)" }
variable "rds_db_name" { type = string default = "app" description = "Database name" }
variable "rds_master_username" { type = string default = "appuser" description = "DB master username" }
variable "rds_master_password" { type = string description = "DB master password" }
variable "rds_multi_az" { type = bool default = false description = "Enable Multi-AZ" }
variable "rds_backup_retention" { type = number default = 7 description = "Backup retention in days" }
variable "rds_deletion_protection" { type = bool default = true description = "Enable deletion protection" }

# Monitoring (Prometheus + Alertmanager on ECS)
variable "monitoring_enabled" { type = bool default = false description = "Deploy Prometheus/Alertmanager on ECS" }
variable "monitoring_desired_count" { type = number default = 1 description = "Number of monitoring task replicas" }
variable "monitoring_scrape_interval" { type = string default = "60s" description = "Prometheus scrape interval" }

variable "monitoring_thresholds" {
  description = "Alert thresholds for monitoring"
  type = object({
    alb_5xx_rate         = optional(number, 5)
    target_healthy_min   = optional(number, 1)
    request_rate_per_min = optional(number, 2000)
  })
  default = {}
}

variable "alertmanager_slack_webhook_url" { type = string default = "" description = "Slack webhook URL for Alertmanager (note: will be stored in state)" }
variable "alertmanager_channel" { type = string default = "#alerts" description = "Slack channel for alerts" }
variable "alertmanager_username" { type = string default = "Alertmanager" description = "Slack username for alerts" }

# SonarQube on ECS
variable "sonarqube_enabled" { type = bool default = true description = "Deploy SonarQube on ECS (staging default: true)" }
variable "sonarqube_desired_count" { type = number default = 1 description = "Number of SonarQube task replicas" }
variable "sonarqube_acm_certificate_arn" { type = string default = null description = "ACM cert ARN for SonarQube ALB HTTPS (optional)" }
variable "sonarqube_health_check_path" { type = string default = "/" description = "Health check path for SonarQube ALB" }
variable "sonarqube_health_check_matcher" { type = string default = "200-399" description = "Health check matcher for SonarQube ALB" }
variable "sonarqube_jdbc_url" { type = string default = "" description = "Optional JDBC URL for SonarQube (empty uses embedded DB; not for prod)" }
variable "sonarqube_jdbc_username" { type = string default = "" description = "Optional JDBC username for SonarQube" }
variable "sonarqube_jdbc_password" { type = string default = "" description = "Optional JDBC password for SonarQube (stored in state)" }
