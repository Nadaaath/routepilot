# ============================================================
# FRONTEND SECURITY GROUP
# ============================================================

resource "hcs_networking_secgroup" "frontend" {
  name                 = "routepilot-frontend-sg"
  description          = "Security group for Route Pilot frontend"
  delete_default_rules = true
}


# Public HTTP access.
#
# Traffic will eventually arrive through:
# Internet -> EIP -> NAT/DNAT -> Frontend ECS

resource "hcs_networking_secgroup_rule" "frontend_http" {
  security_group_id = hcs_networking_secgroup.frontend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = var.frontend_port
  port_range_max = var.frontend_port

  remote_ip_prefix = "0.0.0.0/0"
}


# Public HTTPS access.

resource "hcs_networking_secgroup_rule" "frontend_https" {
  security_group_id = hcs_networking_secgroup.frontend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = var.frontend_https_port
  port_range_max = var.frontend_https_port

  remote_ip_prefix = "0.0.0.0/0"
}


# Frontend outbound access.
#
# Actual Internet connectivity is provided through the
# RoutePilot NAT Gateway and SNAT.

resource "hcs_networking_secgroup_rule" "frontend_egress" {
  security_group_id = hcs_networking_secgroup.frontend.id

  direction = "egress"
  ethertype = "IPv4"

  remote_ip_prefix = "0.0.0.0/0"
}


# ============================================================
# BACKEND SECURITY GROUP
# ============================================================

resource "hcs_networking_secgroup" "backend" {
  name                 = "routepilot-backend-sg"
  description          = "Security group for Route Pilot backend"
  delete_default_rules = true
}


# Only members of the frontend SG can access
# the RoutePilot application backend port.

resource "hcs_networking_secgroup_rule" "backend_from_frontend" {
  security_group_id = hcs_networking_secgroup.backend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = var.backend_port
  port_range_max = var.backend_port

  remote_group_id = hcs_networking_secgroup.frontend.id
}


# Backend outbound access is required for:
# - PostgreSQL connections
# - external APIs
# - package updates
# - application dependencies
#
# Internet access itself is provided by SNAT.

resource "hcs_networking_secgroup_rule" "backend_egress" {
  security_group_id = hcs_networking_secgroup.backend.id

  direction = "egress"
  ethertype = "IPv4"

  remote_ip_prefix = "0.0.0.0/0"
}


# ============================================================
# DATABASE SECURITY GROUP
# ============================================================

resource "hcs_networking_secgroup" "database" {
  name                 = "routepilot-database-sg"
  description          = "Security group for Route Pilot PostgreSQL database"
  delete_default_rules = true
}


# PostgreSQL is reachable only from machines belonging
# to the backend security group.

resource "hcs_networking_secgroup_rule" "database_from_backend" {
  security_group_id = hcs_networking_secgroup.database.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = var.database_port
  port_range_max = var.database_port

  remote_group_id = hcs_networking_secgroup.backend.id
}


# Database outbound access is allowed for operating-system
# updates and package installation through the NAT Gateway.
#
# This DOES NOT expose PostgreSQL to the Internet.
# PostgreSQL ingress remains restricted to the backend SG.

resource "hcs_networking_secgroup_rule" "database_egress" {
  security_group_id = hcs_networking_secgroup.database.id

  direction = "egress"
  ethertype = "IPv4"

  remote_ip_prefix = "0.0.0.0/0"
}


# ============================================================
# TEMPORARY SSH ADMINISTRATION
# ============================================================
#
# The existing Windows jump server currently reaches RoutePilot
# through the RoutePilot public EIP/DNAT path.
#
# 41.137.193.197 is the public source IP used by that
# management server.
#
# These rules are useful while provisioning the ECSs.
# They should be removed once a proper private management path
# (VPN/peering/etc.) exists or when administrative DNAT is removed.


resource "hcs_networking_secgroup_rule" "frontend_ssh_from_management" {
  security_group_id = hcs_networking_secgroup.frontend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 22
  port_range_max = 22

  remote_ip_prefix = var.management_host_ip
}


resource "hcs_networking_secgroup_rule" "backend_ssh_from_management" {
  security_group_id = hcs_networking_secgroup.backend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 22
  port_range_max = 22

  remote_ip_prefix = var.management_host_ip
}


resource "hcs_networking_secgroup_rule" "database_ssh_from_management" {
  security_group_id = hcs_networking_secgroup.database.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 22
  port_range_max = 22

  remote_ip_prefix = var.management_host_ip
}