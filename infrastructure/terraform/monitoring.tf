# ============================================================
# ROUTEPILOT MONITORING SECURITY GROUP
# ============================================================

resource "hcs_networking_secgroup" "monitoring" {
  name                 = "routepilot-monitoring-sg"
  description          = "Security group for RoutePilot Prometheus and Grafana monitoring server"
  delete_default_rules = true
}


# ============================================================
# MONITORING - EGRESS
# ============================================================
#
# Required for:
# - apt updates
# - Prometheus downloads
# - Grafana downloads
# - package repositories
#
# Internet connectivity is provided through the existing
# management subnet SNAT rule.
# ============================================================

resource "hcs_networking_secgroup_rule" "monitoring_egress" {
  security_group_id = hcs_networking_secgroup.monitoring.id

  direction = "egress"
  ethertype = "IPv4"

  remote_ip_prefix = "0.0.0.0/0"
}


# ============================================================
# BASTION -> MONITORING SSH
# ============================================================

resource "hcs_networking_secgroup_rule" "monitoring_ssh_from_bastion" {
  security_group_id = hcs_networking_secgroup.monitoring.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 22
  port_range_max = 22

  remote_group_id = hcs_networking_secgroup.bastion.id
}


# ============================================================
# BASTION -> PROMETHEUS
# ============================================================
#
# Prometheus will remain private.
# We will reach it through an SSH tunnel via the bastion.
# ============================================================

resource "hcs_networking_secgroup_rule" "monitoring_prometheus_from_bastion" {
  security_group_id = hcs_networking_secgroup.monitoring.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 9090
  port_range_max = 9090

  remote_group_id = hcs_networking_secgroup.bastion.id
}


# ============================================================
# BASTION -> GRAFANA
# ============================================================

resource "hcs_networking_secgroup_rule" "monitoring_grafana_from_bastion" {
  security_group_id = hcs_networking_secgroup.monitoring.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 3000
  port_range_max = 3000

  remote_group_id = hcs_networking_secgroup.bastion.id
}


# ============================================================
# MONITORING -> FRONTEND NODE EXPORTER
# ============================================================

resource "hcs_networking_secgroup_rule" "frontend_node_exporter_from_monitoring" {
  security_group_id = hcs_networking_secgroup.frontend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 9100
  port_range_max = 9100

  remote_group_id = hcs_networking_secgroup.monitoring.id
}


# ============================================================
# MONITORING -> BACKEND NODE EXPORTER
# ============================================================

resource "hcs_networking_secgroup_rule" "backend_node_exporter_from_monitoring" {
  security_group_id = hcs_networking_secgroup.backend.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 9100
  port_range_max = 9100

  remote_group_id = hcs_networking_secgroup.monitoring.id
}


# ============================================================
# MONITORING -> DATABASE NODE EXPORTER
# ============================================================

resource "hcs_networking_secgroup_rule" "database_node_exporter_from_monitoring" {
  security_group_id = hcs_networking_secgroup.database.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 9100
  port_range_max = 9100

  remote_group_id = hcs_networking_secgroup.monitoring.id
}


# ============================================================
# MONITORING -> BASTION NODE EXPORTER
# ============================================================

resource "hcs_networking_secgroup_rule" "bastion_node_exporter_from_monitoring" {
  security_group_id = hcs_networking_secgroup.bastion.id

  direction = "ingress"
  ethertype = "IPv4"
  protocol  = "tcp"

  port_range_min = 9100
  port_range_max = 9100

  remote_group_id = hcs_networking_secgroup.monitoring.id
}


# ============================================================
# ROUTEPILOT MONITORING ECS
# ============================================================

resource "hcs_ecs_compute_instance" "monitoring" {
  name        = "routepilot-monitoring"
  description = "RoutePilot Prometheus and Grafana monitoring server"

  availability_zone = data.hcs_availability_zones.available.names[0]

  flavor_id = local.routepilot_flavor.id
  image_id  = local.routepilot_image.id

  key_pair = hcs_ecs_compute_keypair.routepilot.name

  security_group_ids = [
    hcs_networking_secgroup.monitoring.id
  ]

  network {
    uuid        = hcs_vpc_subnet.management.id
    fixed_ip_v4 = "10.100.5.20"
  }

  system_disk_type = "business_type_02"
  system_disk_size = 50

  delete_disks_on_termination = true

  tags = {
    project = "routepilot"
    tier    = "monitoring"
  }
}