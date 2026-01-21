resource "aws_s3_bucket" "this" {
  bucket = var.name
  tags   = merge(var.tags, { Name = var.name })
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    id     = "expire-mpu"
    status = "Enabled"
    filter {
      prefix = ""
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "this" {
  count  = var.cors_rules == null ? 0 : 1
  bucket = aws_s3_bucket.this.id
  dynamic "cors_rule" {
    for_each = var.cors_rules == null ? [] : var.cors_rules
    content {
      allowed_headers = lookup(cors_rule.value, "allowed_headers", ["*"])
      allowed_methods = lookup(cors_rule.value, "allowed_methods", ["GET"])
      allowed_origins = lookup(cors_rule.value, "allowed_origins", ["*"])
      expose_headers  = lookup(cors_rule.value, "expose_headers", [])
      max_age_seconds = lookup(cors_rule.value, "max_age_seconds", 3000)
    }
  }
}

# Optional server access logging
resource "aws_s3_bucket_logging" "this" {
  count         = var.logging_enabled && var.logging_target_bucket != null && var.logging_target_bucket != "" ? 1 : 0
  bucket        = aws_s3_bucket.this.id
  target_bucket = var.logging_target_bucket
  target_prefix = var.logging_target_prefix
}
