# ============================================================
# ROUTE PILOT PUBLIC NAT GATEWAY
# ============================================================

resource "hcs_nat_gateway" "routepilot" {
  name        = "routepilot-nat"
  description = "Public NAT gateway for Route Pilot private workloads"

  spec = "1"

  vpc_id    = hcs_vpc.routepilot.id
  subnet_id = hcs_vpc_subnet.edge.id
}


# ============================================================
# EXISTING AVAILABLE EIP
#
# Existing HCS EIP:
# 41.137.193.212
# Status before use: UNBOUND
# ============================================================

locals {
  routepilot_nat_eip_id = "1e61ed9d-5389-4805-941c-a8fe48b278c4"
}


# ============================================================
# FRONTEND SNAT
# ============================================================

resource "hcs_nat_snat_rule" "frontend" {
  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = local.routepilot_nat_eip_id

  subnet_id   = hcs_vpc_subnet.frontend.id
  source_type = 0

  description = "SNAT for Route Pilot frontend subnet"
}


# ============================================================
# BACKEND SNAT
# ============================================================

resource "hcs_nat_snat_rule" "backend" {
  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = local.routepilot_nat_eip_id

  subnet_id   = hcs_vpc_subnet.backend.id
  source_type = 0

  description = "SNAT for Route Pilot backend subnet"
}