env    = "staging"
project = "ghostmark"
aws_region = "eu-west-2"

upload_bucket_name = "ghostmark-staging-uploads"

# CORS: staging can allow wildcard or the staging domain(s)
allowed_origins = ["*"]

# No ACM by default in staging; set if you attach a custom domain to ALB
# acm_certificate_arn = "arn:aws:acm:eu-west-2:123456789012:certificate/CHANGE-ME"
