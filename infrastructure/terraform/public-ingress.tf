# ============================================================
# PUBLIC APPLICATION INGRESS
# ============================================================
#
# Public HTTP traffic is forwarded through the RoutePilot
# NAT Gateway EIP to the frontend ECS.
#
# Internet :80 -> frontend :80
#
# Backend and database remain private and are never directly
# exposed as part of the application ingress path.
# ============================================================

resource "hcs_nat_dnat_rule" "frontend_http" {
  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id

  # HCS DNAT requires the network port ID.
  #
  # Referencing the ECS dynamically avoids hardcoding the
  # OpenStack/HCS port UUID.
  port_id = hcs_ecs_compute_instance.frontend.network[0].port

  protocol = "tcp"

  external_service_port = 80
  internal_service_port = 80

  description = "Public HTTP access to RoutePilot frontend"
}