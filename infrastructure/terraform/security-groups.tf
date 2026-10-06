# ============================================================
# FRONTEND SECURITY GROUP
# ============================================================

resource "hcs_networking_secgroup" "frontend" {
  name                 = "routepilot-frontend-sg"
  description          = "Security group for Route Pilot frontend"
  delete_default_rules = true
}


# ============================================================
# FRONTEND - PUBLIC HTTP
# ============================================================
#
# Public traffic arrives through:
#
# Internet -> EIP -> NAT/DNAT -> Frontend ECS
# ============================================================

resource "hcs_networking_secgroup_rule" "frontend_http" {
  security_group_id = hcs_networking_secgroup.frontend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = var.frontend_port
  port_range_max = var.frontend_port

  remote_ip_prefix = "0.0.0.0/0"
}


# ============================================================
# FRONTEND - PUBLIC HTTPS
# ============================================================

resource "hcs_networking_secgroup_rule" "frontend_https" {
  security_group_id = hcs_networking_secgroup.frontend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = var.frontend_https_port
  port_range_max = var.frontend_https_port

  remote_ip_prefix = "0.0.0.0/0"
}


# ============================================================
# FRONTEND - EGRESS
# ============================================================
#
# Internet connectivity is provided through the RoutePilot
# NAT Gateway and frontend SNAT rule.
# ============================================================

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


# ============================================================
# FRONTEND -> BACKEND
# ============================================================
#
# Only ECSs belonging to the frontend security group can
# access the RoutePilot backend application port.
# ============================================================

resource "hcs_networking_secgroup_rule" "backend_from_frontend" {
  security_group_id = hcs_networking_secgroup.backend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = var.backend_port
  port_range_max = var.backend_port

  remote_group_id = hcs_networking_secgroup.frontend.id
}


# ============================================================
# BACKEND - EGRESS
# ============================================================
#
# Required for:
#
# - PostgreSQL connections
# - external APIs
# - operating-system updates
# - application dependencies
#
# Internet access itself is provided by SNAT.
# ============================================================

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


# ============================================================
# BACKEND -> DATABASE
# ============================================================
#
# PostgreSQL can only be reached by machines belonging to
# the RoutePilot backend security group.
# ============================================================

resource "hcs_networking_secgroup_rule" "database_from_backend" {
  security_group_id = hcs_networking_secgroup.database.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = var.database_port
  port_range_max = var.database_port

  remote_group_id = hcs_networking_secgroup.backend.id
}


# ============================================================
# DATABASE - EGRESS
# ============================================================
#
# Currently retained for operating-system updates and package
# installation through the NAT Gateway.
#
# This does NOT expose PostgreSQL to the Internet.
# PostgreSQL ingress remains restricted to the backend SG.
# ============================================================

resource "hcs_networking_secgroup_rule" "database_egress" {
  security_group_id = hcs_networking_secgroup.database.id

  direction = "egress"
  ethertype = "IPv4"

  remote_ip_prefix = "0.0.0.0/0"
}


# ============================================================
# BASTION SECURITY GROUP
# ============================================================
#
# The bastion is the single controlled administrative entry
# point into the RoutePilot environment.
# ============================================================

resource "hcs_networking_secgroup" "bastion" {
  name        = "routepilot-bastion-sg"
  description = "Security group for RoutePilot bastion and management host"
}


# ============================================================
# WINDOWS MANAGEMENT HOST -> BASTION SSH
# ============================================================
#
# Only the authorized company Windows jump server public IP
# may reach SSH on the bastion through the NAT DNAT rule.
# ============================================================

resource "hcs_networking_secgroup_rule" "bastion_ssh_from_management" {
  security_group_id = hcs_networking_secgroup.bastion.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 22
  port_range_max = 22

  remote_ip_prefix = var.management_host_ip
}


# ============================================================
# BASTION - EGRESS
# ============================================================

resource "hcs_networking_secgroup_rule" "bastion_egress" {
  security_group_id = hcs_networking_secgroup.bastion.id

  direction = "egress"
  ethertype = "IPv4"

  remote_ip_prefix = "0.0.0.0/0"
}


# ============================================================
# BASTION -> FRONTEND SSH
# ============================================================

resource "hcs_networking_secgroup_rule" "frontend_ssh_from_bastion" {
  security_group_id = hcs_networking_secgroup.frontend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 22
  port_range_max = 22

  remote_group_id = hcs_networking_secgroup.bastion.id
}


# ============================================================
# BASTION -> BACKEND SSH
# ============================================================

resource "hcs_networking_secgroup_rule" "backend_ssh_from_bastion" {
  security_group_id = hcs_networking_secgroup.backend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 22
  port_range_max = 22

  remote_group_id = hcs_networking_secgroup.bastion.id
}


# ============================================================
# BASTION -> DATABASE SSH
# ============================================================

resource "hcs_networking_secgroup_rule" "database_ssh_from_bastion" {
  security_group_id = hcs_networking_secgroup.database.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 22
  port_range_max = 22

  remote_group_id = hcs_networking_secgroup.bastion.id
}