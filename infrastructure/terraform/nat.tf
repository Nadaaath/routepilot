# ============================================================
# ROUTE PILOT PUBLIC NAT GATEWAY
# ============================================================

resource "hcs_nat_gateway" "routepilot" {
  name        = "routepilot-nat"
  description = "Public NAT gateway for Route Pilot private workloads"

  spec = "1"

  vpc_id = hcs_vpc.routepilot.id

  # The currently working NAT Gateway is attached to the
  # database subnet. We keep that attachment for now to avoid
  # replacing a working NAT Gateway.
  #
  # This does NOT mean that the NAT belongs only to the DB tier.
  subnet_id = hcs_vpc_subnet.database.id
}


# ============================================================
# FRONTEND SNAT
# ============================================================

resource "hcs_nat_snat_rule" "frontend" {
  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id

  subnet_id   = hcs_vpc_subnet.frontend.id
  source_type = 0

  description = "SNAT for Route Pilot frontend subnet"
}


# ============================================================
# BACKEND SNAT
# ============================================================

resource "hcs_nat_snat_rule" "backend" {
  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id

  subnet_id   = hcs_vpc_subnet.backend.id
  source_type = 0

  description = "SNAT for Route Pilot backend subnet"
}


# ============================================================
# DATABASE SNAT
# ============================================================

resource "hcs_nat_snat_rule" "database" {
  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id

  subnet_id   = hcs_vpc_subnet.database.id
  source_type = 0

  description = "SNAT for Route Pilot database subnet"

  # The DB SNAT rule already exists in HCS and was imported.
  # Do not recreate it only because its existing description
  # differs from the Terraform description.
  lifecycle {
    ignore_changes = [
      description
    ]
  }
}

resource "hcs_nat_snat_rule" "management" {
  nat_gateway_id = hcs_nat_gateway.routepilot.id
  floating_ip_id = var.routepilot_nat_eip_id
  subnet_id      = hcs_vpc_subnet.management.id

  description = "SNAT for RoutePilot management subnet"
}