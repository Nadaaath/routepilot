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

variable "vpc_cidr" {
  description = "Route Pilot VPC CIDR"
  type        = string
  default     = "10.100.0.0/16"
}

variable "edge_subnet_cidr" {
  description = "Edge subnet CIDR"
  type        = string
  default     = "10.100.10.0/24"
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
} # ============================================================
# Application ports
# ============================================================

variable "frontend_port" {
  description = "Port used by Nginx on the frontend VM"
  type        = number
  default     = 80
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

variable "management_host_ip" {
  description = "Private IP of the authorized Windows jump server"
  type        = string
  default     = "10.20.1.100/32"
}
