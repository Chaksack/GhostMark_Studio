variable "name" {
  type        = string
  description = "Base name/prefix for SonarQube resources"
}

variable "cluster_arn" {
  type        = string
  description = "ECS cluster ARN to run the SonarQube task"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID for ALB and security groups"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for the ECS service (awsvpc) and ALB"
}

variable "alb_subnet_ids" {
  type        = list(string)
  default     = null
  description = "Optional subnet IDs specifically for the ALB; if null, uses subnet_ids"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Common tags to apply"
}

variable "desired_count" {
  type        = number
  default     = 1
  description = "Number of task replicas"
}

variable "cpu" {
  type        = number
  default     = 1024
  description = "Task CPU units (Fargate)"
}

variable "memory" {
  type        = number
  default     = 2048
  description = "Task memory (MiB)"
}

variable "aws_region" {
  type        = string
  description = "AWS region (for logs)"
}

variable "assign_public_ip" {
  type        = bool
  default     = true
  description = "Whether to assign a public IP to the task ENIs"
}

variable "acm_certificate_arn" {
  type        = string
  default     = null
  description = "ACM certificate ARN for enabling HTTPS on the SonarQube ALB. If null/empty, HTTPS listener is not created."
}

variable "sonar_jdbc_url" {
  type        = string
  default     = ""
  description = "Optional JDBC URL for SonarQube (e.g., jdbc:postgresql://host:5432/sonar). If empty, SonarQube uses embedded DB (not for production)."
}

variable "sonar_jdbc_username" {
  type        = string
  default     = ""
  description = "Optional JDBC username"
}

variable "sonar_jdbc_password" {
  type        = string
  default     = ""
  description = "Optional JDBC password (note: stored in state)"
}

variable "sonar_jdbc_username_secret_arn" {
  type        = string
  default     = ""
  description = "Optional Secrets Manager ARN for JDBC username"
}

variable "sonar_jdbc_password_secret_arn" {
  type        = string
  default     = ""
  description = "Optional Secrets Manager ARN for JDBC password"
}

variable "health_check_path" {
  type        = string
  default     = "/"
  description = "ALB target group health check path"
}

variable "health_check_matcher" {
  type        = string
  default     = "200-399"
  description = "ALB target group health check HTTP codes"
}
