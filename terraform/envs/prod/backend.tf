terraform {
  backend "s3" {
    bucket         = "CHANGE_ME-prod-terraform-state"
    key            = "infra/terraform.tfstate"
    region         = "eu-west-2"
    dynamodb_table = "CHANGE_ME-prod-terraform-locks"
    encrypt        = true
  }
}
