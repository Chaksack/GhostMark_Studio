Areas for Improvement
Security Issues
1. No HTTPS/TLS on ALB (modules/ecs/main.tf:51-63)
   - ALB listener only handles HTTP on port 80 with a fixed response
   - No HTTPS listener configured, no ACM certificate integration
   - Traffic between users and ALB is unencrypted
2. Overly permissive CORS (envs/prod/main.tf:32-34)
   - allowed_origins = ["*"] allows any domain to make requests
   - Should restrict to your actual domains in production
3. Wide-open security group ingress (modules/ecs/main.tf:14-15)
   - ALB accepts traffic from 0.0.0.0/0 - fine for public apps, but consider WAF
4. No WAF integration
   - CloudFront and ALB have no Web Application Firewall protection
5. Missing S3 access logging
   - No server access logging enabled on the uploads bucket
   Reliability & Availability
6. No private subnets (modules/vpc/main.tf)
   - Only public subnets exist; ECS tasks run with public IPs
   - Best practice: run containers in private subnets behind ALB
7. No Auto Scaling
   - ECS module creates cluster but no services, task definitions, or auto-scaling policies
8. ALB has no health check tuning
   - Default health check at / with matcher 200-399 - may not suit all apps
9. No multi-region or disaster recovery
   - Single region deployment (eu-west-2)
   9:31
   Configuration & Maintainability
10. Placeholder values in backend (envs/prod/backend.tf:3,6)
    bucket         = "CHANGE_ME-prod-terraform-state"
    dynamodb_table = "CHANGE_ME-prod-terraform-locks"
    - Should use actual values or be documented
11. Duplicate code between envs/prod/ and envs/staging/
    - Both main.tf files are identical
    - Consider using tfvars files or workspaces instead
12. Duplicate ALB module (modules/alb/ vs code in modules/ecs/)
    - ALB resources exist in both modules; only ECS module is used
    - Dead code in modules/alb/
13. Missing variable descriptions (envs/prod/variables.tf)
    - Variables lack description fields for documentation
14. Loose provider version constraints (versions.tf:7)
    - >= 5.0 could cause unexpected changes; pin to ~> 5.x
    Missing Infrastructure
15. No ECS task definitions or services
    - Cluster exists but nothing runs on it
    - No IAM roles for task execution
16. No CloudWatch alarms or monitoring
    - Container Insights enabled but no alerting
17. No secrets management integration
    - VPC endpoint for Secrets Manager exists but no actual secrets resources
18. CloudFront missing custom domain
    - Uses default CloudFront certificate, no Route53 integration for CDN
    Cost Optimization
19. Interface VPC endpoints are expensive
   - 6 interface endpoints × ~$7.50/month each = ~$45/month
   - Consider if all are necessary, or use NAT Gateway instead if traffic is low

\nVerification Status (2026-01-21)
Summary of what has been addressed in the repo versus the items listed above. File paths and notes included for traceability.

- 1. HTTPS/TLS on ALB — Fixed
  - Implemented HTTPS listener with optional ACM certificate and HTTP→HTTPS redirect.
  - Evidence: terraform/modules/ecs/main.tf (aws_lb_listener.http redirect; aws_lb_listener.https with certificate_arn).
  - Wired via variable acm_certificate_arn in envs (staging/prod).

- 2. Overly permissive CORS — Fixed (prod), Configurable (staging)
  - Prod now restricts allowed_origins to explicit domains in terraform/envs/prod/terraform.tfvars.
  - Staging keeps ["*"] by design; configurable via allowed_origins variable.

- 3. Wide-open security group ingress — Not addressed (Recommendation noted)
  - ALB SG still allows 0.0.0.0/0 on ports 80/443 (public app acceptable, consider WAF).
  - Evidence: terraform/modules/ecs/main.tf (aws_security_group.alb ingress rules).

- 4. No WAF integration — Not addressed
  - No AWS WAF resources integrated with ALB/CloudFront in codebase.

- 5. Missing S3 access logging — Partially fixed
  - Added optional logging to S3 module and enabled for prod uploads bucket with a dedicated logs bucket.
  - Evidence: terraform/modules/s3/main.tf (aws_s3_bucket_logging); terraform/envs/prod/main.tf (module "upload_logs" and uploads logging_enabled=true).
  - Staging does not enable logging by default.

- 6. No private subnets — Fixed
  - VPC module now creates both public and private subnets across the specified AZs, with a managed NAT Gateway for egress from private subnets.
  - ECS tasks (monitoring stack and RDS) are placed in private subnets by default; ALBs remain in public subnets.
  - Evidence: terraform/modules/vpc/main.tf (aws_subnet.private, aws_nat_gateway, private route table and associations; interface endpoints use private subnets when present). Envs wiring: terraform/envs/*/main.tf (monitoring and RDS use module.vpc.private_subnet_ids).

- 7. No Auto Scaling — Not addressed
  - No ECS service/task definitions or scaling policies present.

- 8. ALB health check tuning — Fixed
  - Parameterized health check path and matcher and wired in envs.
  - Evidence: terraform/modules/ecs/main.tf (target group health_check), variables.tf; envs/*/main.tf.

- 9. No multi-region/DR — Not addressed
  - Single-region deployment persists.

- 10. Placeholder values in backend — Not addressed (Documented)
  - terraform/envs/prod/backend.tf retains CHANGE_ME placeholders; operators must set real values before apply.

- 11. Duplicate code between envs — Partially addressed
  - Some divergence (e.g., S3 logging in prod), but main.tf structures remain largely duplicated. Consolidation via shared modules/tfvars/workspaces is still recommended.

- 12. Duplicate ALB module — Not addressed
  - terraform/modules/alb directory exists but is unused; consider removing to avoid dead code.

- 13. Missing variable descriptions — Fixed
  - variables.tf files in envs now include descriptions for clarity.

- 14. Loose provider version constraints — Fixed
  - Providers pinned to ~> 5.49 (aws) and ~> 3.6 (random) in root and envs.

- 15. No ECS task definitions or services — Not addressed
  - Cluster and ALB exist, but no running services/tasks are defined.

- 16. No CloudWatch alarms/monitoring — Fixed
  - Replaced by Prometheus + Alertmanager stack on ECS. CloudWatch metrics are scraped via cloudwatch_exporter, and alerting is configured for ALB 5xx rate, unhealthy targets (downtime), and traffic overload. Enabled per-environment via monitoring_enabled. Evidence:
    - Module: terraform/modules/monitoring-ecs (ECS task/service, IAM, configs)
    - Wired in envs: terraform/envs/staging/main.tf (module "monitoring" with count); terraform/envs/prod/main.tf (module "monitoring")
    - Variables: terraform/envs/*/variables.tf (monitoring_* vars and Alertmanager settings)
    - Defaults and thresholds in prod tfvars: terraform/envs/prod/terraform.tfvars
  - Important: The monitoring ECS service runs in the same ECS cluster as the application. The env modules pass module.ecs.cluster_arn into the monitoring module, and aws_ecs_service.cluster uses that ARN (no separate cluster is created). Evidence: terraform/envs/*/main.tf (cluster_arn = module.ecs.cluster_arn) and terraform/modules/monitoring-ecs/main.tf (aws_ecs_service.this.cluster = var.cluster_arn).
  - Note: Alert delivery uses Slack webhook stored in TF state; consider migrating to SSM Parameter Store/Secrets Manager and passing at runtime in a future iteration.

- 17. No secrets management integration — Partially fixed
  - Environments can now source sensitive values from AWS Secrets Manager when ARNs are provided:
    - RDS master password via rds_master_password_secret_arn (envs/*/variables.tf and main.tf).
    - Alertmanager Slack webhook via alertmanager_slack_webhook_secret_arn (monitoring module wiring) to avoid storing in Terraform state.
    - SonarQube JDBC username/password may be sourced from Secrets Manager in staging (variables and module wiring).
  - We did not add Terraform-managed secret resources themselves; operators should create/manage secrets out-of-band or in a follow-up module.
  - Evidence: terraform/envs/*/{variables.tf, main.tf}; terraform/modules/monitoring-ecs/*; terraform/modules/sonarqube-ecs/*.

- 18. CloudFront missing custom domain — Not addressed
  - CDN module usage does not configure custom domain or ACM cert/Route53 for CloudFront.

- 19. Interface VPC endpoints cost — Not addressed
  - Multiple Interface endpoints still provisioned in VPC module; review necessity vs. NAT approach.

Operator Notes / Next Steps
- Replace placeholders in terraform/envs/prod/backend.tf and prod tfvars (ACM ARN, domain list) before apply.
- Consider implementing WAF, ECS application services with autoscaling, CloudFront custom domain with ACM/Route53, and formal Secrets Manager resources in subsequent iterations.
- Note: Terraform HCL formatting has been normalized to pass `terraform validate` in both envs; keep this style for future additions.
- Remove terraform/modules/alb if confirmed unused to reduce maintenance burden.

Strapi CMS Integration (Medusa v2 Storefront) — 2026-03-08
- A minimal Strapi integration is added to the Next.js storefront to consume CMS content without breaking existing flows.
  - File: ghostmark-storefront/src/lib/strapi.ts — tiny server-safe client that reads STRAPI_URL and STRAPI_API_TOKEN, with graceful fallback when not set.
  - Page example: ghostmark-storefront/src/app/[countryCode]/(main)/customer-stories/page.tsx — fetches `api/customer-stories?populate=cover` and renders a basic grid of stories. If Strapi is not configured, shows a helpful message.
- Environment variables (added to ghostmark-storefront/.env.template):
  - STRAPI_URL — Base URL of the Strapi instance (e.g., http://localhost:1337)
  - STRAPI_API_TOKEN — API Token if the collection type is not public (Settings → API Tokens in Strapi)
- Expected content type in Strapi (example):
  - Collection Type: Customer Story (collectionName: customer-stories)
    - title (Text)
    - excerpt (Text, optional)
    - slug (UID, optional)
    - cover (Media, Single)
    - publishedAt (DateTime)
- Permissions:
  - If using a public API, enable find/findOne for the collection type in Settings → Users & Permissions Plugin → Roles → Public.
  - For secured APIs, create an API Token in Settings → API Tokens and set STRAPI_API_TOKEN in the storefront.
- CDN/Image domains:
  - If Strapi serves media from a different domain, add that host to next.config.js images.remotePatterns.
- Backend (Medusa v2) coupling:
  - No backend plugin was added to avoid dependency drift; storefront-only read access was implemented per minimal-change policy. Future work could wire @medusajs CMS workflows or webhooks to sync entities. Document desired coupling before implementation.

ShipStation Fulfillment Provider (2026-01-23)
- The backend registers a custom ShipStation fulfillment provider and reads credentials from environment variables.
  - Code: ghostmark/src/modules/shipstation (provider implementation), wired in ghostmark/medusa-config.ts under the fulfillment module providers with id "shipstation".
  - Env vars used:
    - SHIPSTATION_API_KEY
    - SHIPSTATION_API_SECRET
    - SHIPSTATION_STORE_ID (optional)
    - SHIPSTATION_BASE_URL (optional; defaults to https://ssapi.shipstation.com)
- Local development templates updated:
  - ghostmark/.env.template contains the variables with comments.
  - ghostmark/.env now includes empty placeholders for the same variables; set real values to enable live API calls.
- Behavior:
  - On startup, if API key/secret are missing, the provider logs a warning and remains registered; API calls are effectively disabled to avoid runtime failures.
  - The current implementation includes a minimal client stub; replace with real HTTP calls to ShipStation endpoints for production use if desired.
  - Labels in Admin: When credentials are present, the provider now returns a stub label object in the fulfillment response so the Medusa Admin dashboard displays a label entry (tracking number, tracking URL, label URL). In production, replace the stub with the actual label URL returned by ShipStation's label purchase endpoint.
- Deployment:
  - Ensure these variables are provided to your ECS task/container at runtime (e.g., via task definition env vars, SSM parameters, or Secrets Manager). CI/CD wiring is environment-specific and should map these variables from your secret store.

SonarQube Deployment & CI (2026-01-21)
- Deployed SonarQube on ECS Fargate in the same cluster as the application, behind a dedicated ALB with optional HTTPS.
  - Module: terraform/modules/sonarqube-ecs (ALB, target group, listeners, ECS task/service, IAM execution role, CloudWatch Logs)
  - Staging: Enabled by default (embedded DB/H2). See terraform/envs/staging/{variables.tf, main.tf}. Output: sonarqube_url.
  - Production: Disabled by default; enable after providing external JDBC database and (optionally) ACM certificate. See terraform/envs/prod/{variables.tf, main.tf}. Output: sonarqube_url.
- CI integration: .github/workflows/pipeline.yml includes a "SonarQube Code Analysis" job which runs scans for both ghostmark (backend) and ghostmark-storefront when SONAR_HOST_URL and SONAR_TOKEN secrets are configured in GitHub.
- Notes:
  - H2 is not recommended for production; configure sonarqube_jdbc_url/username/password for a managed PostgreSQL instance when enabling in prod.
  - Consider moving JDBC credentials to Secrets Manager/SSM Parameter Store and injecting at runtime to avoid storing in Terraform state.