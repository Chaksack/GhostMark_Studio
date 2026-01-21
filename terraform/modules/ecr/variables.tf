variable "name_prefix" {
  type        = string
  description = "Name prefix for ECR repositories"
}

variable "repositories" {
  type        = list(string)
  description = "List of repository names (suffixes) to create"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Common tags to apply"
}
