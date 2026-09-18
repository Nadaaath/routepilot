# ============================================================
# Availability Zones
# ============================================================

data "hcs_availability_zones" "available" {}


# ============================================================
# ECS Flavors
#
# Look for 2 vCPU / 4 GB flavors.
# ============================================================

data "hcs_ecs_compute_flavors" "routepilot" {
  availability_zone = data.hcs_availability_zones.available.names[0]

  cpu_core_count = 2
  memory_size    = 4
}


# ============================================================
# Ubuntu Images
# ============================================================

data "hcs_ims_images" "ubuntu" {
  os           = "Ubuntu"
  architecture = "x86_64"
  visibility   = "public"
}

# ============================================================
# Select the Route Pilot compute configuration
# ============================================================

locals {
  routepilot_flavor = [
    for flavor in data.hcs_ecs_compute_flavors.routepilot.flavors :
    flavor
    if flavor.name == "gp.small.2C4G"
  ][0]

  routepilot_image = [
    for image in data.hcs_ims_images.ubuntu.images :
    image
    if image.name == "UBUNTU-24.04-LTS-STD-SERVER"
  ][0]
}

# ============================================================
# Existing EIPs - temporary discovery
# ============================================================

data "hcs_vpc_eips" "existing" {}