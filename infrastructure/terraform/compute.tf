# ============================================================
# ROUTE PILOT FRONTEND ECS
# ============================================================

resource "hcs_ecs_compute_instance" "frontend" {
  name        = "routepilot-frontend"
  description = "Route Pilot frontend server"

  availability_zone = data.hcs_availability_zones.available.names[0]

  flavor_id = local.routepilot_flavor.id
  image_id  = local.routepilot_image.id

  key_pair = hcs_ecs_compute_keypair.routepilot.name

  security_group_ids = [
    hcs_networking_secgroup.frontend.id
  ]

  network {
    uuid        = hcs_vpc_subnet.frontend.id
    fixed_ip_v4 = "10.100.1.10"
  }

  system_disk_type = "business_type_02"
  system_disk_size = 50

  delete_disks_on_termination = true

  tags = {
    project = "routepilot"
    tier    = "frontend"
  }
}


# ============================================================
# ROUTE PILOT BACKEND ECS
# ============================================================

resource "hcs_ecs_compute_instance" "backend" {
  name        = "routepilot-backend"
  description = "Route Pilot backend and optimization server"

  availability_zone = data.hcs_availability_zones.available.names[0]

  flavor_id = local.routepilot_flavor.id
  image_id  = local.routepilot_image.id

  key_pair = hcs_ecs_compute_keypair.routepilot.name

  security_group_ids = [
    hcs_networking_secgroup.backend.id
  ]

  network {
    uuid        = hcs_vpc_subnet.backend.id
    fixed_ip_v4 = "10.100.2.10"
  }

  system_disk_type = "business_type_02"
  system_disk_size = 50

  delete_disks_on_termination = true

  tags = {
    project = "routepilot"
    tier    = "backend"
  }
}


# ============================================================
# ROUTE PILOT DATABASE ECS
# ============================================================

resource "hcs_ecs_compute_instance" "database" {
  name        = "routepilot-database"
  description = "Route Pilot PostgreSQL database server"

  availability_zone = data.hcs_availability_zones.available.names[0]

  flavor_id = local.routepilot_flavor.id
  image_id  = local.routepilot_image.id

  key_pair = hcs_ecs_compute_keypair.routepilot.name

  security_group_ids = [
    hcs_networking_secgroup.database.id
  ]

  network {
    uuid        = hcs_vpc_subnet.database.id
    fixed_ip_v4 = "10.100.3.10"
  }

  system_disk_type = "business_type_02"
  system_disk_size = 50

  delete_disks_on_termination = true

  tags = {
    project = "routepilot"
    tier    = "database"
  }
}