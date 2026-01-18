variable "env" { type = string }
variable "project" { type = string }
variable "aws_region" { type = string default = "eu-west-2" }

variable "vpc_cidr" { type = string default = "10.20.0.0/16" }
variable "public_subnet_cidrs" { type = list(string) default = ["10.20.1.0/24", "10.20.2.0/24", "10.20.3.0/24"] }
variable "azs" { type = list(string) default = ["eu-west-2a", "eu-west-2b", "eu-west-2c"] }

variable "upload_bucket_name" { type = string }

# Optional Route53 DNS for ALB
variable "route53_enabled" { type = bool default = false }
variable "route53_hosted_zone_id" { type = string default = "" }
variable "route53_domain_name" { type = string default = "" }

# Optional RDS
variable "rds_enabled" { type = bool default = false }
variable "rds_engine" { type = string default = "postgres" }
variable "rds_engine_version" { type = string default = "14" }
variable "rds_instance_class" { type = string default = "db.t4g.small" }
variable "rds_allocated_storage" { type = number default = 50 }
variable "rds_db_name" { type = string default = "app" }
variable "rds_master_username" { type = string default = "appuser" }
variable "rds_master_password" { type = string }
variable "rds_multi_az" { type = bool default = true }
variable "rds_backup_retention" { type = number default = 14 }
variable "rds_deletion_protection" { type = bool default = true }
