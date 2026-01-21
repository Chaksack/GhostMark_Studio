variable "name" {
  type        = string
  description = "Base name/prefix for monitoring service resources"
}

variable "cluster_arn" {
  type        = string
  description = "ECS cluster ARN to run the monitoring task"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for the ECS service (awsvpc)"
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security group IDs to attach to the task ENIs"
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
  default     = 512
  description = "Task CPU units (Fargate)"
}

variable "memory" {
  type        = number
  default     = 1024
  description = "Task memory (MiB)"
}

variable "assign_public_ip" {
  type        = bool
  default     = true
  description = "Whether to assign a public IP to the task ENIs"
}

variable "aws_region" {
  type        = string
  description = "AWS region for CloudWatch exporter"
}

variable "scrape_interval" {
  type        = string
  default     = "60s"
  description = "Prometheus scrape interval"
}

variable "alertmanager_slack_webhook_url" {
  type        = string
  default     = ""
  description = "Slack webhook URL for Alertmanager (note: stored in state)"
}

variable "alertmanager_slack_webhook_secret_arn" {
  type        = string
  default     = ""
  description = "Optional Secrets Manager ARN for Slack webhook; when set, the value is injected via ECS secrets and not stored in state"
}

variable "alertmanager_channel" {
  type        = string
  default     = "#alerts"
  description = "Slack channel for alerts"
}

variable "alertmanager_username" {
  type        = string
  default     = "Alertmanager"
  description = "Slack username for alerts"
}

variable "thresholds" {
  description = "Alert thresholds"
  type = object({
    alb_5xx_rate         = optional(number, 5)    # requests/min over 5m
    target_healthy_min   = optional(number, 1)
    request_rate_per_min = optional(number, 2000)
  })
  default = {}
}
