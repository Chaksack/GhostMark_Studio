variable "hosted_zone_id" {
  type        = string
  description = "Route53 hosted zone ID"
}

variable "record_name" {
  type        = string
  description = "DNS record name to create"
}

variable "alb_dns_name" {
  type        = string
  description = "ALB DNS name"
}

variable "alb_zone_id" {
  type        = string
  description = "ALB hosted zone ID"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Common tags to apply"
}
