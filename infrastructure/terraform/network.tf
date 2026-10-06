# ============================================================
# ROUTE PILOT VPC
# ============================================================

resource "hcs_vpc" "routepilot" {
  name = "routepilot-vpc"
  cidr = var.vpc_cidr
}


# ============================================================
# FRONTEND SUBNET
# ============================================================

resource "hcs_vpc_subnet" "frontend" {
  name       = "routepilot-frontend-subnet"
  cidr       = var.frontend_subnet_cidr
  gateway_ip = "10.100.1.1"
  vpc_id     = hcs_vpc.routepilot.id

  primary_dns   = var.primary_dns
  secondary_dns = var.secondary_dns
}


# ============================================================
# BACKEND SUBNET
# ============================================================

resource "hcs_vpc_subnet" "backend" {
  name       = "routepilot-backend-subnet"
  cidr       = var.backend_subnet_cidr
  gateway_ip = "10.100.2.1"
  vpc_id     = hcs_vpc.routepilot.id

  primary_dns   = var.primary_dns
  secondary_dns = var.secondary_dns
}


# ============================================================
# DATABASE SUBNET
# ============================================================

resource "hcs_vpc_subnet" "database" {
  name       = "routepilot-database-subnet"
  cidr       = var.database_subnet_cidr
  gateway_ip = "10.100.3.1"
  vpc_id     = hcs_vpc.routepilot.id

  primary_dns   = var.primary_dns
  secondary_dns = var.secondary_dns
}


# ============================================================
# EDGE SUBNET
# ============================================================
#
# Dedicated subnet for network-edge services.
#
# The ELB currently uses this subnet.
# The NAT Gateway will also be migrated here later, in a
# separate controlled Terraform change.
# ============================================================

resource "hcs_vpc_subnet" "edge" {
  name       = "routepilot-edge-subnet"
  cidr       = var.edge_subnet_cidr
  gateway_ip = "10.100.4.1"
  vpc_id     = hcs_vpc.routepilot.id

  primary_dns   = var.primary_dns
  secondary_dns = var.secondary_dns
}


# ============================================================
# MANAGEMENT SUBNET
# ============================================================
#
# Contains the RoutePilot bastion and Jenkins.
# ============================================================

resource "hcs_vpc_subnet" "management" {
  name       = "routepilot-management-subnet"
  cidr       = var.management_subnet_cidr
  gateway_ip = "10.100.5.1"
  vpc_id     = hcs_vpc.routepilot.id

  primary_dns   = var.primary_dns
  secondary_dns = var.secondary_dns
}