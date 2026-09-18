# ============================================================
# Route Pilot SSH Key Pair
# ============================================================

resource "hcs_ecs_compute_keypair" "routepilot" {
  name     = "routepilot-keypair"
  key_file = "routepilot-keypair.pem"
}