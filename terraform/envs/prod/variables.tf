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
