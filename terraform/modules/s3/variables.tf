variable "name" { type = string }
variable "cors_rules" { type = any default = null }
variable "tags" { type = map(string) default = {} }
