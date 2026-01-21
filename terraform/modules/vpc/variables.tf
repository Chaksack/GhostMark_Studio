variable "name" {
  type        = string
  description = "Base name/prefix for VPC resources"
}

variable "cidr_block" {
  type        = string
  description = "CIDR block for the VPC"
}

variable "azs" {
  type        = list(string)
  description = "List of availability zones to use"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets"
}

variable "private_subnet_cidrs" {
  type        = list(string)
  default     = []
  description = "CIDR blocks for private subnets"
}

variable "region" {
  type        = string
  description = "AWS region (used for endpoint names)"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Common tags to apply"
}
