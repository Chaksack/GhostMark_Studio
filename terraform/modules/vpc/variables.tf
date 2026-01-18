variable "name" { type = string }
variable "cidr_block" { type = string }
variable "azs" { type = list(string) }
variable "public_subnet_cidrs" { type = list(string) }
variable "region" { type = string }
variable "tags" { type = map(string) default = {} }
