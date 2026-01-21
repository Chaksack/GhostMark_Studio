locals {
  name = var.name

  # Prometheus config: scrape only the local cloudwatch_exporter
  prometheus_config = <<-EOT
    global:
      scrape_interval: ${var.scrape_interval}

    scrape_configs:
      - job_name: 'cloudwatch'
        static_configs:
          - targets: ['127.0.0.1:9106']

    rule_files:
      - /etc/prometheus/alerts.yml
  EOT

  # Minimal alert rules; note: metric names depend on cloudwatch_exporter config
  alerts_rules = <<-EOT
    groups:
    - name: cloudwatch-alerts
      rules:
      - alert: ALBHigh5xxErrors
        expr: rate(aws_applicationelb_httpcode_elb_5xx_count_sum[5m]) > ${var.thresholds.alb_5xx_rate}
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High 5xx errors on ALB
          description: "ALB 5xx error rate is above ${var.thresholds.alb_5xx_rate}/min for over 5 minutes"

      - alert: ALBAllTargetsUnhealthy
        expr: aws_applicationelb_targethealthyhostcount_minimum < ${var.thresholds.target_healthy_min}
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: All ALB targets are unhealthy
          description: "TargetHealthyHostCount dropped below ${var.thresholds.target_healthy_min} for more than 2 minutes"

      - alert: ALBTrafficOverload
        expr: sum(rate(aws_applicationelb_request_count_sum[5m])) > ${var.thresholds.request_rate_per_min}
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High request rate (possible overload)
          description: "Request count per minute exceeded ${var.thresholds.request_rate_per_min} for 5 minutes"
  EOT

  # CloudWatch exporter config to pull selected metrics
  cloudwatch_exporter_config = <<-EOT
    region: ${var.aws_region}
    metrics:
      - aws_namespace: AWS/ApplicationELB
        aws_metric_name: HTTPCode_ELB_5XX_Count
        aws_statistics: [ Sum ]
        period_seconds: 60
        range_seconds: 300
      - aws_namespace: AWS/ApplicationELB
        aws_metric_name: RequestCount
        aws_statistics: [ Sum ]
        period_seconds: 60
        range_seconds: 300
      - aws_namespace: AWS/ApplicationELB
        aws_metric_name: TargetHealthyHostCount
        aws_statistics: [ Minimum ]
        period_seconds: 60
        range_seconds: 300
  EOT

  alertmanager_config = <<-EOT
    route:
      receiver: 'slack'
      group_by: ['alertname']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
    receivers:
      - name: 'slack'
        slack_configs:
          - api_url: '${var.alertmanager_slack_webhook_url}'
            channel: '${var.alertmanager_channel}'
            username: '${var.alertmanager_username}'
            send_resolved: true
  EOT
}

resource "aws_iam_role" "task_execution" {
  name               = "${local.name}-mon-exec"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "task_execution_policy" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task_role" {
  name               = "${local.name}-mon-task"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json
  tags               = var.tags
}

data "aws_iam_policy_document" "task_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "cloudwatch_exporter" {
  statement {
    effect = "Allow"
    actions = [
      "cloudwatch:GetMetricData",
      "cloudwatch:GetMetricStatistics",
      "cloudwatch:ListMetrics"
    ]
    resources = ["*"]
  }
  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:CreateLogGroup",
      "logs:DescribeLogStreams"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "cloudwatch_exporter" {
  name   = "${local.name}-mon-cw-policy"
  policy = data.aws_iam_policy_document.cloudwatch_exporter.json
}

resource "aws_iam_role_policy_attachment" "task_role_attach" {
  role       = aws_iam_role.task_role.name
  policy_arn = aws_iam_policy.cloudwatch_exporter.arn
}

resource "aws_cloudwatch_log_group" "prometheus" {
  name              = "/ecs/${local.name}-prometheus"
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "alertmanager" {
  name              = "/ecs/${local.name}-alertmanager"
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "exporter" {
  name              = "/ecs/${local.name}-cloudwatch-exporter"
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_ecs_task_definition" "this" {
  family                   = "${local.name}-monitoring"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task_role.arn

  container_definitions = jsonencode([
    {
      name      = "cloudwatch-exporter"
      image     = "ghcr.io/prometheus/cloudwatch_exporter:latest"
      essential = true
      portMappings = [{ containerPort = 9106, hostPort = 9106, protocol = "tcp" }]
      environment = [
        { name = "AWS_REGION", value = var.aws_region },
        { name = "CW_CONFIG", value = local.cloudwatch_exporter_config }
      ]
      entryPoint = ["/bin/sh", "-lc"]
      command    = ["printf '%s' \"$CW_CONFIG\" > /config.yml && /bin/cloudwatch_exporter /config.yml"]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.exporter.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    },
    {
      name      = "prometheus"
      image     = "prom/prometheus:latest"
      essential = true
      portMappings = [{ containerPort = 9090, hostPort = 9090, protocol = "tcp" }]
      environment = [
        { name = "PROM_CONFIG", value = local.prometheus_config },
        { name = "ALERTS_CONFIG", value = local.alerts_rules }
      ]
      entryPoint = ["/bin/sh", "-lc"]
      command    = ["mkdir -p /etc/prometheus && printf '%s' \"$PROM_CONFIG\" > /etc/prometheus/prometheus.yml && printf '%s' \"$ALERTS_CONFIG\" > /etc/prometheus/alerts.yml && /bin/prometheus --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/prometheus --web.enable-lifecycle"]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.prometheus.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    },
    {
      name      = "alertmanager"
      image     = "prom/alertmanager:latest"
      essential = true
      portMappings = [{ containerPort = 9093, hostPort = 9093, protocol = "tcp" }]
      environment = var.alertmanager_slack_webhook_secret_arn != "" ? [
        { name = "ALERTMANAGER_CHANNEL", value = var.alertmanager_channel },
        { name = "ALERTMANAGER_USERNAME", value = var.alertmanager_username }
      ] : [
        { name = "ALERTMANAGER_CONFIG", value = local.alertmanager_config }
      ]
      secrets = var.alertmanager_slack_webhook_secret_arn != "" ? [
        { name = "ALERTMANAGER_WEBHOOK_URL", valueFrom = var.alertmanager_slack_webhook_secret_arn }
      ] : []
      entryPoint = ["/bin/sh", "-lc"]
      command    = var.alertmanager_slack_webhook_secret_arn != "" ? [
        "mkdir -p /etc/alertmanager && cat > /etc/alertmanager/alertmanager.yml <<'EOF'\nroute:\n  receiver: 'slack'\n  group_by: ['alertname']\n  group_wait: 30s\n  group_interval: 5m\n  repeat_interval: 4h\nreceivers:\n  - name: 'slack'\n    slack_configs:\n      - api_url: \"$ALERTMANAGER_WEBHOOK_URL\"\n        channel: \"$ALERTMANAGER_CHANNEL\"\n        username: \"$ALERTMANAGER_USERNAME\"\n        send_resolved: true\nEOF\n && /bin/alertmanager --config.file=/etc/alertmanager/alertmanager.yml"
      ] : [
        "mkdir -p /etc/alertmanager && printf '%s' \"$ALERTMANAGER_CONFIG\" > /etc/alertmanager/alertmanager.yml && /bin/alertmanager --config.file=/etc/alertmanager/alertmanager.yml"
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.alertmanager.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
  tags = var.tags
}

resource "aws_ecs_service" "this" {
  name            = "${local.name}-monitoring"
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  enable_execute_command = false

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = var.assign_public_ip
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  tags = var.tags
}

output "service_name" { value = aws_ecs_service.this.name }
output "task_definition_arn" { value = aws_ecs_task_definition.this.arn }
output "log_groups" {
  value = {
    prometheus = aws_cloudwatch_log_group.prometheus.name
    alertmanager = aws_cloudwatch_log_group.alertmanager.name
    exporter = aws_cloudwatch_log_group.exporter.name
  }
}
