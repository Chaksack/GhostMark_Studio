env    = "prod"
project = "ghostmark"
aws_region = "eu-west-2"

upload_bucket_name = "ghostmark-prod-uploads"

# Bucket for S3 server access logs for the uploads bucket
upload_logs_bucket_name = "ghostmark-prod-uploads-logs"

# Restrict CORS to your production domains
allowed_origins = [
  "https://ghostmarkstudio.com",
  "https://www.ghostmakestudio.com"
]

# ACM certificate for ALB HTTPS (in same region as ALB)
acm_certificate_arn = "arn:aws:acm:eu-west-2:123456789012:certificate/CHANGE-ME"

# Optional: tune health check if your app uses a different path
# health_check_path = "/healthz"
# health_check_matcher = "200-399"

# Monitoring (Prometheus + Alertmanager on ECS)
monitoring_enabled        = true
monitoring_desired_count  = 1
monitoring_scrape_interval = "60s"
monitoring_thresholds = {
  alb_5xx_rate         = 5
  target_healthy_min   = 1
  request_rate_per_min = 5000
}

# Caution: this value is stored in Terraform state; consider using an SSM parameter
alertmanager_slack_webhook_url = "https://hooks.slack.com/services/CHANGE/ME/PLEASE"
alertmanager_channel           = "#infra-alerts"
alertmanager_username          = "Alertmanager"
