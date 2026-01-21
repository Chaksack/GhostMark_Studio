locals {
  name      = "${var.name}-sonarqube"
  use_https = var.acm_certificate_arn != null && var.acm_certificate_arn != ""
}

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb-sg"
  description = "Security group for SonarQube ALB"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${local.name}-alb-sg" })
}

resource "aws_security_group" "tasks" {
  name        = "${local.name}-tasks-sg"
  description = "Security group for SonarQube ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 9000
    to_port         = 9000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${local.name}-tasks-sg" })
}

resource "aws_lb" "this" {
  name               = replace(local.name, ".", "-")
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.alb_subnet_ids != null ? var.alb_subnet_ids : var.subnet_ids
  tags               = merge(var.tags, { Name = local.name })
}

resource "aws_lb_target_group" "http" {
  name        = substr("${replace(local.name, ".", "-")}-tg", 0, 32)
  port        = 9000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    matcher = var.health_check_matcher
    path    = var.health_check_path
  }

  tags = merge(var.tags, { Name = "${local.name}-tg" })
}

resource "aws_lb_listener" "http_redirect" {
  count             = local.use_https ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "http_forward" {
  count             = local.use_https ? 0 : 1
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.http.arn
  }
}

resource "aws_lb_listener" "https" {
  count             = local.use_https ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.http.arn
  }
}

resource "aws_cloudwatch_log_group" "sonarqube" {
  name              = "/ecs/${local.name}"
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_iam_role" "task_execution" {
  name               = "${replace(local.name, ".", "-")}-exec"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "exec_policy" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
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

resource "aws_ecs_task_definition" "this" {
  family                   = local.name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.task_execution.arn

  dynamic "ephemeral_storage" {
    for_each = var.memory >= 2048 ? [1] : []
    content {
      size_in_gib = 21
    }
  }

  container_definitions = jsonencode([
    {
      name      = "sonarqube"
      image     = "sonarqube:latest"
      essential = true
      portMappings = [{ containerPort = 9000, hostPort = 9000, protocol = "tcp" }]
      environment = concat(
        var.sonar_jdbc_url == "" ? [] : [
          { name = "SONAR_JDBC_URL", value = var.sonar_jdbc_url },
          { name = "SONAR_JDBC_USERNAME", value = var.sonar_jdbc_username },
          { name = "SONAR_JDBC_PASSWORD", value = var.sonar_jdbc_password }
        ],
        []
      )
      secrets = concat(
        var.sonar_jdbc_username_secret_arn != "" ? [
          { name = "SONAR_JDBC_USERNAME", valueFrom = var.sonar_jdbc_username_secret_arn }
        ] : [],
        var.sonar_jdbc_password_secret_arn != "" ? [
          { name = "SONAR_JDBC_PASSWORD", valueFrom = var.sonar_jdbc_password_secret_arn }
        ] : []
      )
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.sonarqube.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_service" "this" {
  name            = local.name
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = var.assign_public_ip
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.http.arn
    container_name   = "sonarqube"
    container_port   = 9000
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  tags = var.tags
}

output "alb_dns_name" {
  value = aws_lb.this.dns_name
}

output "url" {
  value = format("%s://%s", local.use_https ? "https" : "http", aws_lb.this.dns_name)
}

