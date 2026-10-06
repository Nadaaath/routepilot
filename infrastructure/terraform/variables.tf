# ============================================================
# HCS CREDENTIALS
# ============================================================

variable "hcs_access_key" {
  description = "HCS access key"
  type        = string
  sensitive   = true
}

variable "hcs_secret_key" {
  description = "HCS secret key"
  type        = string
  sensitive   = true
}


# ============================================================
# NETWORK
# ============================================================

variable "vpc_cidr" {
  description = "Route Pilot VPC CIDR"
  type        = string
  default     = "10.100.0.0/16"
}

variable "frontend_subnet_cidr" {
  description = "Frontend subnet CIDR"
  type        = string
  default     = "10.100.1.0/24"
}

variable "backend_subnet_cidr" {
  description = "Backend subnet CIDR"
  type        = string
  default     = "10.100.2.0/24"
}

variable "database_subnet_cidr" {
  description = "Database subnet CIDR"
  type        = string
  default     = "10.100.3.0/24"
}

variable "edge_subnet_cidr" {
  description = "Edge subnet CIDR for Route Pilot network services such as ELB and NAT"
  type        = string
  default     = "10.100.4.0/24"
}

variable "management_subnet_cidr" {
  description = "CIDR block for RoutePilot management subnet"
  type        = string
  default     = "10.100.5.0/24"
}


# ============================================================
# DNS
# ============================================================
#
# Replace these with corporate/internal DNS servers if the
# HCS administrator provides them.
# ============================================================

variable "primary_dns" {
  description = "Primary DNS server distributed to Route Pilot ECSs"
  type        = string
  default     = "8.8.8.8"
}

variable "secondary_dns" {
  description = "Secondary DNS server distributed to Route Pilot ECSs"
  type        = string
  default     = "1.1.1.1"
}


# ============================================================
# APPLICATION PORTS
# ============================================================

variable "frontend_port" {
  description = "HTTP port used by Nginx on the frontend VM"
  type        = number
  default     = 80
}

variable "frontend_https_port" {
  description = "HTTPS port used by Nginx on the frontend VM"
  type        = number
  default     = 443
}

variable "backend_port" {
  description = "Port used by the Route Pilot backend"
  type        = number
  default     = 8000
}

variable "database_port" {
  description = "PostgreSQL port"
  type        = number
  default     = 5432
}


# ============================================================
# MANAGEMENT ACCESS
# ============================================================
#
# Public source IP of the company Windows jump server.
#
# The Windows jump server is allowed to reach only the
# RoutePilot bastion over SSH.
#
# Application ECSs are administered privately through
# the bastion.
# ============================================================

variable "management_host_ip" {
  description = "Public source CIDR allowed to SSH to the RoutePilot bastion"
  type        = string
  default     = "41.137.193.197/32"
}


# ============================================================
# EXISTING NAT EIP
# ============================================================
#
# This must contain the HCS EIP RESOURCE UUID belonging to:
#
#     41.137.193.196
#
# Do NOT put the IPv4 address itself here.
# ============================================================

variable "routepilot_nat_eip_id" {
  description = "Resource ID of the existing EIP 41.137.193.196 used by Route Pilot NAT"
  type        = string
}

variable "routepilot_nat_public_ip" {
  description = "Public IPv4 address used by Route Pilot NAT"
  type        = string
  default     = "41.137.193.196"
}


# ============================================================
# ADMINISTRATION DNAT
# ============================================================
#
# Bastion SSH remains enabled because it is the management
# entry point into RoutePilot.
#
# Direct SSH DNAT to application ECSs is disabled by default.
# ============================================================

variable "enable_bastion_dnat" {
  description = "Enable public SSH DNAT to the RoutePilot bastion"
  type        = bool
  default     = true
}

variable "enable_direct_ecs_admin_dnat" {
  description = "Enable temporary direct SSH DNAT to frontend, backend and database ECSs"
  type        = bool
  default     = false
}


# ============================================================
# ELB PUBLIC EIP
# ============================================================

variable "routepilot_elb_eip_id" {
  description = "Resource ID of the EIP used by the Route Pilot public ELB"
  type        = string
}


# ============================================================
# ELB TLS CERTIFICATE
# ============================================================

variable "routepilot_elb_certificate_id" {
  description = "ID of the self-signed server certificate used by the RoutePilot HTTPS listener"
  type        = string
}