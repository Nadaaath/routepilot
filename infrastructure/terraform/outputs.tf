# ============================================================
# VPC / SUBNET OUTPUTS
# ============================================================

output "routepilot_vpc_id" {
  description = "Route Pilot VPC ID"
  value       = hcs_vpc.routepilot.id
}

output "frontend_subnet_id" {
  description = "Route Pilot frontend subnet ID"
  value       = hcs_vpc_subnet.frontend.id
}

output "backend_subnet_id" {
  description = "Route Pilot backend subnet ID"
  value       = hcs_vpc_subnet.backend.id
}

output "database_subnet_id" {
  description = "Route Pilot database subnet ID"
  value       = hcs_vpc_subnet.database.id
}


# ============================================================
# SECURITY GROUP OUTPUTS
# ============================================================

output "frontend_security_group_id" {
  description = "Route Pilot frontend security group ID"
  value       = hcs_networking_secgroup.frontend.id
}

output "backend_security_group_id" {
  description = "Route Pilot backend security group ID"
  value       = hcs_networking_secgroup.backend.id
}

output "database_security_group_id" {
  description = "Route Pilot database security group ID"
  value       = hcs_networking_secgroup.database.id
}


# ============================================================
# HCS COMPUTE DISCOVERY
# ============================================================

output "available_availability_zones" {
  description = "Availability zones available in HCS"
  value       = data.hcs_availability_zones.available.names
}

output "candidate_ecs_flavors" {
  description = "Available 2 vCPU / 4 GB ECS flavors"

  value = [
    for flavor in data.hcs_ecs_compute_flavors.routepilot.flavors : {
      id        = flavor.id
      name      = flavor.name
      vcpus     = flavor.vcpus
      ram       = flavor.ram
      boot_type = flavor.ext_boot_type
    }
  ]
}

output "available_ubuntu_images" {
  description = "Available public Ubuntu x86_64 images"

  value = [
    for image in data.hcs_ims_images.ubuntu.images : {
      id          = image.id
      name        = image.name
      os_version  = image.os_version
      min_disk_gb = image.min_disk_gb
      status      = image.status
    }
  ]
}


# ============================================================
# ECS OUTPUTS
# ============================================================

output "frontend_private_ip" {
  description = "Private IP address of the Route Pilot frontend"
  value       = hcs_ecs_compute_instance.frontend.access_ip_v4
}

output "backend_private_ip" {
  description = "Private IP address of the Route Pilot backend"
  value       = hcs_ecs_compute_instance.backend.access_ip_v4
}

output "database_private_ip" {
  description = "Private IP address of the Route Pilot database"
  value       = hcs_ecs_compute_instance.database.access_ip_v4
}


# ============================================================
# NAT OUTPUTS
# ============================================================

output "nat_gateway_id" {
  description = "Route Pilot NAT gateway ID"
  value       = hcs_nat_gateway.routepilot.id
}

output "nat_public_ip" {
  description = "Existing EIP used by Route Pilot NAT"
  value       = var.routepilot_nat_public_ip
}

output "routepilot_elb_id" {
  description = "Route Pilot ELB resource ID"
  value       = hcs_elb_loadbalancer.routepilot.id
}

output "routepilot_elb_private_ip" {
  description = "Private IPv4 address of the Route Pilot ELB"
  value       = hcs_elb_loadbalancer.routepilot.ipv4_address
}