variable "name" {
  type        = string
  description = "Name used for CloudFront resources"
}

variable "bucket_domain_name" {
  type        = string
  description = "Domain name of the S3 bucket origin (e.g., bucket.s3.amazonaws.com)"
}

variable "bucket_arn" {
  type        = string
  description = "ARN of the S3 bucket origin"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Common tags to apply"
}
