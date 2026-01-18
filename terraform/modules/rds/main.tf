resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-subnets"
  subnet_ids = var.public_subnet_ids
  tags       = merge(var.tags, { Name = "${var.name}-subnets" })
}

resource "aws_security_group" "rds" {
  name        = "${var.name}-rds-sg"
  description = "Security group for RDS"
  vpc_id      = var.vpc_id

  # Allow DB port from ECS tasks SG only
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.tasks_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name}-rds-sg" })
}

resource "aws_db_instance" "this" {
  identifier                 = var.name
  engine                     = var.engine
  engine_version             = var.engine_version
  port                       = var.db_port
  instance_class             = var.instance_class
  allocated_storage          = var.allocated_storage
  storage_type               = var.storage_type
  storage_encrypted          = var.storage_encrypted
  db_name                    = var.db_name
  username                   = var.master_username
  password                   = var.master_password
  multi_az                   = var.multi_az
  deletion_protection        = var.deletion_protection
  apply_immediately          = var.apply_immediately
  backup_retention_period    = var.backup_retention
  preferred_backup_window    = var.backup_window
  preferred_maintenance_window = var.maintenance_window

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.this.name
  publicly_accessible    = false
  skip_final_snapshot    = var.skip_final_snapshot
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot  = true

  tags = merge(var.tags, { Name = var.name })
}
