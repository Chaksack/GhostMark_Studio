variable "name" { type = string description = "Base name/prefix for ECS/ALB resources" }
variable "vpc_id" { type = string description = "VPC ID where resources will be created" }
variable "public_subnet_ids" { type = list(string) description = "Public subnet IDs for ALB" }
variable "tags" { type = map(string) default = {} description = "Common tags to apply" }

variable "acm_certificate_arn" {
  type        = string
  default     = null
  description = "ACM certificate ARN for enabling HTTPS on the ALB listener. If null or empty, HTTPS listener is not created."
}

variable "health_check_path" {
  type        = string
  default     = "/"
  description = "Health check path for the target group"
}

variable "health_check_matcher" {
  type        = string
  default     = "200-399"
  description = "HTTP codes to match for healthy status"
}
