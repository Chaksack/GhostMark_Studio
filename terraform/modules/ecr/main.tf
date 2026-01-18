resource "aws_ecr_repository" "this" {
  for_each                 = toset(var.repositories)
  name                     = "${var.name_prefix}-${each.key}"
  image_scanning_configuration { scan_on_push = true }
  image_tag_mutability     = "MUTABLE"
  encryption_configuration { encryption_type = "AES256" }
  tags = merge(var.tags, { Name = "${var.name_prefix}-${each.key}" })
}

resource "aws_ecr_lifecycle_policy" "lifecycle" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name
  policy     = jsonencode({
    rules = [
      {
        rulePriority = 1,
        description  = "Expire untagged older than 30 days",
        selection    = { tagStatus = "untagged", countType = "sinceImagePushed", countUnit = "days", countNumber = 30 },
        action       = { type = "expire" }
      }
    ]
  })
}
