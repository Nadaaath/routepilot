# ============================================================
# TEMPORARY ADMINISTRATION ACCESS
# ============================================================
#
# These DNAT rules expose SSH temporarily through the Route
# Pilot public EIP so the Windows management/jump server can
# administer the three ECS instances.
#
# They are NOT part of the permanent application ingress.
#
# Later, when private management connectivity is available,
# set:
#
#   enable_admin_dnat = false
#
# and Terraform will remove these three DNAT rules.
# ============================================================


# ============================================================
# FRONTEND SSH
#
# 41.137.193.196:2221 -> 10.100.1.10:22
# ============================================================

resource "hcs_nat_dnat_rule" "frontend_ssh" {
  count = var.enable_admin_dnat ? 1 : 0

  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id

  port_id = hcs_ecs_compute_instance.frontend.network[0].port

  protocol = "tcp"

  external_service_port = 2221
  internal_service_port = 22

  description = "Temporary SSH access to Route Pilot frontend"
}


# ============================================================
# BACKEND SSH
#
# 41.137.193.196:2222 -> 10.100.2.10:22
# ============================================================

resource "hcs_nat_dnat_rule" "backend_ssh" {
  count = var.enable_admin_dnat ? 1 : 0

  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id

  port_id = hcs_ecs_compute_instance.backend.network[0].port

  protocol = "tcp"

  external_service_port = 2222
  internal_service_port = 22

  description = "Temporary SSH access to Route Pilot backend"
}


# ============================================================
# DATABASE SSH
#
# 41.137.193.196:2223 -> 10.100.3.10:22
#
# This DNAT rule already exists manually in HCS.
# It must be imported into Terraform state before applying.
# ============================================================

resource "hcs_nat_dnat_rule" "database_ssh" {
  count = var.enable_admin_dnat ? 1 : 0

  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id

  port_id = hcs_ecs_compute_instance.database.network[0].port

  protocol = "tcp"

  external_service_port = 2223
  internal_service_port = 22

  description = "Temporary SSH access to Route Pilot database"

  # The existing DB rule was created manually.
  # Do not recreate it solely because its description differs.
  lifecycle {
    ignore_changes = [
      description
    ]
  }
}

resource "hcs_nat_dnat_rule" "bastion_ssh" {
  count = var.enable_admin_dnat ? 1 : 0

  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id

  port_id = hcs_ecs_compute_instance.bastion.network[0].port

  protocol              = "tcp"
  external_service_port = 2220
  internal_service_port = 22

  description = "Temporary SSH access to RoutePilot bastion"
}