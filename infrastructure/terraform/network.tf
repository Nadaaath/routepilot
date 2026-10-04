resource "hcs_vpc" "routepilot" {
  name = "routepilot-vpc"
  cidr = var.vpc_cidr
}

variable "edge_subnet_cidr" {
  description = "Edge subnet CIDR for Route Pilot network services such as ELB"
  type        = string
  default     = "10.100.4.0/24"
}

resource "hcs_vpc_subnet" "frontend" {
  name       = "routepilot-frontend-subnet"
  cidr       = var.frontend_subnet_cidr
  gateway_ip = "10.100.1.1"
  vpc_id     = hcs_vpc.routepilot.id

  primary_dns   = var.primary_dns
  secondary_dns = var.secondary_dns
}

resource "hcs_vpc_subnet" "backend" {
  name       = "routepilot-backend-subnet"
  cidr       = var.backend_subnet_cidr
  gateway_ip = "10.100.2.1"
  vpc_id     = hcs_vpc.routepilot.id

  primary_dns   = var.primary_dns
  secondary_dns = var.secondary_dns
}

resource "hcs_vpc_subnet" "database" {
  name       = "routepilot-database-subnet"
  cidr       = var.database_subnet_cidr
  gateway_ip = "10.100.3.1"
  vpc_id     = hcs_vpc.routepilot.id

  primary_dns   = var.primary_dns
  secondary_dns = var.secondary_dns
}

resource "hcs_vpc_subnet" "management" {
  name       = "routepilot-management-subnet"
  cidr       = var.management_subnet_cidr
  gateway_ip = "10.100.5.1"
  vpc_id     = hcs_vpc.routepilot.id

  primary_dns   = "8.8.8.8"
  secondary_dns = "1.1.1.1"
}