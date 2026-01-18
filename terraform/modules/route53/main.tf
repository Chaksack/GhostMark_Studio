# A record (IPv4) alias to ALB
resource "aws_route53_record" "a_alias" {
  zone_id = var.hosted_zone_id
  name    = var.record_name
  type    = "A"
  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = false
  }
}

# AAAA record (IPv6) alias to ALB
resource "aws_route53_record" "aaaa_alias" {
  zone_id = var.hosted_zone_id
  name    = var.record_name
  type    = "AAAA"
  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = false
  }
}
