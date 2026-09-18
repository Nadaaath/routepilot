resource "hcs_vpc" "routepilot" {
  name = "routepilot-vpc"
  cidr = "10.100.0.0/16"
}

resource "hcs_vpc_subnet" "frontend" {
  name       = "routepilot-frontend-subnet"
  cidr       = "10.100.1.0/24"
  gateway_ip = "10.100.1.1"
  vpc_id     = hcs_vpc.routepilot.id
}

resource "hcs_vpc_subnet" "backend" {
  name       = "routepilot-backend-subnet"
  cidr       = "10.100.2.0/24"
  gateway_ip = "10.100.2.1"
  vpc_id     = hcs_vpc.routepilot.id
}

resource "hcs_vpc_subnet" "database" {
  name       = "routepilot-database-subnet"
  cidr       = "10.100.3.0/24"
  gateway_ip = "10.100.3.1"
  vpc_id     = hcs_vpc.routepilot.id
}

resource "hcs_vpc_subnet" "edge" {
  name       = "routepilot-edge-subnet"
  cidr       = "10.100.10.0/24"
  gateway_ip = "10.100.10.1"

  vpc_id = hcs_vpc.routepilot.id
}