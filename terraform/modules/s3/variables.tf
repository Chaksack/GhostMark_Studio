variable "name" {
  type        = string
  description = "Bucket name"
}

variable "cors_rules" {
  type        = any
  default     = null
  description = "List of CORS rule objects, or null to disable"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Common tags to apply"
}

variable "logging_enabled" {
  type        = bool
  default     = false
  description = "Enable server access logging"
}

variable "logging_target_bucket" {
  type        = string
  default     = null
  description = "Target bucket name for access logs"
}

variable "logging_target_prefix" {
  type        = string
  default     = "logs/"
  description = "Prefix for access logs in the target bucket"
}
