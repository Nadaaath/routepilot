# ============================================================
# Security Group Outputs
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
# HCS Compute Discovery
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
# ECS Outputs
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
# NAT Outputs
# ============================================================

output "nat_gateway_id" {
  description = "Route Pilot NAT gateway ID"
  value       = hcs_nat_gateway.routepilot.id
}

output "nat_public_ip" {
  description = "Existing EIP used by Route Pilot NAT"
  value       = "41.137.193.212"
}

output "existing_eips" {
  description = "Existing EIPs in the current HCS project"

  value = [
    for eip in data.hcs_vpc_eips.existing.eips : {
      id                   = eip.id
      name                 = eip.name
      public_ip            = eip.public_ip
      type                 = eip.type
      bandwidth_name       = eip.bandwidth_name
      bandwidth_size       = eip.bandwidth_size
      bandwidth_share_type = eip.bandwidth_share_type
      status               = eip.status
    }
  ]
}