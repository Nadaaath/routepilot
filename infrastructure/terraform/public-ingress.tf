# ============================================================
# PUBLIC APPLICATION INGRESS
# ============================================================
#
# Public HTTP traffic is forwarded through the RoutePilot
# NAT Gateway EIP to the frontend ECS.
#
# Internet :80 -> frontend :80
#
# Backend and database remain private and are not exposed.
# ============================================================
resource "hcs_nat_dnat_rule" "frontend_http" {
  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id

  port_id = "929c2982-8ad2-4c36-922b-3bcf37ca9e0e"

  protocol = "tcp"

  external_service_port = 80
  internal_service_port = 80

  description = "Public HTTP access to RoutePilot frontend"
}