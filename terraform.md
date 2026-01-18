Terraform Architecture Generation Prompt (No NAT Gateway)
Role:
You are a Senior DevOps / Cloud Infrastructure Engineer specializing in Terraform on AWS, CI/CD pipelines, and cost-optimized multi-environment architectures.
Objective:
Generate a modular Terraform codebase that provisions AWS infrastructure for two environments: staging and prod, following best practices, cost optimization, and security, without using any NAT Gateway.
🚫 NAT Gateway Constraint (Very Important)
DO NOT create or reference NAT Gateways
DO NOT create private subnets that require outbound internet access
All compute resources must work without NAT
Use VPC Endpoints where required instead of NAT
🧱 Environments
staging
prod
Environment-specific variables and Terraform state
2️⃣ Terraform State Management
Use S3 backend for Terraform state
Enable:
Versioning
Encryption (SSE-S3 or SSE-KMS)
Use DynamoDB for state locking
One backend per environment
3️⃣ Networking (No NAT Design)
VPC Module Requirements
Single VPC per environment
Public subnets only
Internet Gateway attached
Route tables with 0.0.0.0/0 → IGW
Security groups used to restrict access
No private subnet routing via NAT
VPC Endpoints (Mandatory)
Create Interface or Gateway VPC Endpoints for:
S3 (Gateway endpoint)
ECR (ecr.api, ecr.dkr)
CloudWatch Logs
ECS
SSM
Secrets Manager (if used)
These endpoints allow ECS tasks and AWS services to function without NAT
4️⃣ Core AWS Modules
🔹 ECR
Private repositories
Image scanning on push
Lifecycle rules
🔹 ECS (Fargate – Public Subnets)
ECS cluster
Services deployed into public subnets
Assign public IPs
Application Load Balancer
Auto scaling
Environment-specific task sizes
🔹 RDS
RDS instance or cluster
Publicly accessible = false
Deployed into public subnets
Security group restricts access to ECS only
Multi-AZ in prod
Encrypted storage
Automated backups
🔹 Redis (ElastiCache)
Redis replication group
No public endpoint
Security group access only from ECS
Multi-node in prod
Engine version configurable
🔹 S3 (Uploads)
S3 bucket for uploads
Private access only
Lifecycle rules
Encryption
CORS configuration
Used as CloudFront origin
🔹 CloudFront CDN
Distribution for uploads
HTTPS enforced
Origin Access Control (OAC)
Cache policies
Optional custom domains
🔹 CloudWatch
ECS log groups
Log retention
Alarms:
ECS CPU & memory
RDS CPU & free storage
Redis memory usage
🔹 Notifications
SNS topics
Slack notifications (webhook or AWS Chatbot)
Email subscriptions
Triggered by CloudWatch alarms
🗂️ Folder Structure
terraform/
├── modules/
│   ├── vpc/
│   ├── ecs/
│   ├── ecr/
│   ├── rds/
│   ├── redis/
│   ├── s3/
│   ├── cloudfront/
│   ├── cloudwatch/
│   └── notifications/
├── envs/
│   ├── staging/
│   │   ├── main.tf
│   │   ├── backend.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   └── prod/
│       ├── main.tf
│       ├── backend.tf
│       ├── variables.tf
│       └── terraform.tfvars
└── versions.tf
⚙️ GitHub Actions CI/CD
🔍 Validation Pipeline
Trigger on PRs and staging pushes
Run:
terraform fmt
terraform init
terraform validate
terraform plan
🚀 Deployments
Staging
Auto-apply on push to staging
Production
Push to main
Manual approval via GitHub Environments
Explicit confirmation step
🧨 Destroy Workflow
Manual trigger only
Disabled by default for prod
Slack + Email notifications:
Before destroy
After destroy
🔔 Notifications
Send Slack & Email alerts for:
Plan failures
Apply success/failure
Destroy start/completion
🔐 Security & Best Practices
IAM roles with least privilege
No secrets in Terraform
Use SSM or Secrets Manager
Resource tagging:
tags = {
Environment = var.env
Project     = "your-project-name"
ManagedBy   = "Terraform"
}
📄 Output Requirements
Real Terraform code only
Clean module inputs/outputs
Clear comments
Working GitHub Actions YAML
No NAT Gateway anywhere in the code