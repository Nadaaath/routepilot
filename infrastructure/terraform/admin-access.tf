# ============================================================
# ROUTE PILOT ADMINISTRATION ACCESS
# ============================================================
#
# Permanent management model:
#
#   Windows jump server
#          |
#          | SSH through public NAT EIP
#          | TCP 2220
#          v
#   RoutePilot bastion
#          |
#          | Private SSH inside the VPC
#          v
#   Frontend / Backend / Database
#
# Direct public SSH DNAT to the application ECSs is disabled
# by default and should only be enabled temporarily for
# troubleshooting if absolutely necessary.
# ============================================================


# ============================================================
# FRONTEND SSH - TEMPORARY / DISABLED BY DEFAULT
#
# 41.137.193.196:2221 -> frontend:22
# ============================================================

resource "hcs_nat_dnat_rule" "frontend_ssh" {
  count = var.enable_direct_ecs_admin_dnat ? 1 : 0

  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id

  port_id = hcs_ecs_compute_instance.frontend.network[0].port

  protocol = "tcp"

  external_service_port = 2221
  internal_service_port = 22

  description = "Temporary direct SSH access to RoutePilot frontend"
}


# ============================================================
# BACKEND SSH - TEMPORARY / DISABLED BY DEFAULT
#
# 41.137.193.196:2222 -> backend:22
# ============================================================

resource "hcs_nat_dnat_rule" "backend_ssh" {
  count = var.enable_direct_ecs_admin_dnat ? 1 : 0

  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id

  port_id = hcs_ecs_compute_instance.backend.network[0].port

  protocol = "tcp"

  external_service_port = 2222
  internal_service_port = 22

  description = "Temporary direct SSH access to RoutePilot backend"
}


# ============================================================
# DATABASE SSH - TEMPORARY / DISABLED BY DEFAULT
#
# 41.137.193.196:2223 -> database:22
# ============================================================

resource "hcs_nat_dnat_rule" "database_ssh" {
  count = var.enable_direct_ecs_admin_dnat ? 1 : 0

  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id

  port_id = hcs_ecs_compute_instance.database.network[0].port

  protocol = "tcp"

  external_service_port = 2223
  internal_service_port = 22

  description = "Temporary direct SSH access to RoutePilot database"

  lifecycle {
    ignore_changes = [
      description
    ]
  }
}


# ============================================================
# BASTION SSH
#
# 41.137.193.196:2220 -> bastion:22
#
# This remains enabled because the bastion is the controlled
# administrative entry point into the RoutePilot VPC.
# ============================================================

resource "hcs_nat_dnat_rule" "bastion_ssh" {
  count = var.enable_bastion_dnat ? 1 : 0

  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id

  port_id = hcs_ecs_compute_instance.bastion.network[0].port

  protocol = "tcp"

  external_service_port = 2220
  internal_service_port = 22

  description = "SSH access to RoutePilot bastion"
}