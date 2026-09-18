# ============================================================
# FRONTEND SECURITY GROUP
# ============================================================

resource "hcs_networking_secgroup" "frontend" {
  name                 = "routepilot-frontend-sg"
  description          = "Security group for Route Pilot frontend"
  delete_default_rules = true
}


# Allow HTTP traffic from the edge subnet.
# Later the Load Balancer will live/use this edge network.

resource "hcs_networking_secgroup_rule" "frontend_http_from_edge" {
  security_group_id = hcs_networking_secgroup.frontend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = var.frontend_port
  port_range_max = var.frontend_port

  remote_ip_prefix = var.edge_subnet_cidr
}


# Allow frontend outbound traffic.
# This does NOT automatically give the VM Internet access.
# Routing/NAT will decide whether an Internet path actually exists.

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


# Only machines belonging to the frontend security group
# can reach the Route Pilot backend port.

resource "hcs_networking_secgroup_rule" "backend_from_frontend" {
  security_group_id = hcs_networking_secgroup.backend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = var.backend_port
  port_range_max = var.backend_port

  remote_group_id = hcs_networking_secgroup.frontend.id
}


# Backend needs outbound traffic later for:
# - PostgreSQL
# - external routing API
# - package updates
#
# NAT/routing will still control actual Internet connectivity.

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


# PostgreSQL can only be reached by machines belonging
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


# Allow outbound at SG level for now.
#
# Later, the DATABASE ROUTE TABLE will prevent Internet access,
# so this does not mean the database becomes Internet-accessible.

resource "hcs_networking_secgroup_rule" "database_egress" {
  security_group_id = hcs_networking_secgroup.database.id

  direction = "egress"
  ethertype = "IPv4"

  remote_ip_prefix = "0.0.0.0/0"
}

# ============================================================
# SSH ADMINISTRATION FROM MANAGEMENT / JUMP SERVER
# ============================================================

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