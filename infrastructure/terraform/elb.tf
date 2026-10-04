# ============================================================
# ROUTEPILOT ELASTIC LOAD BALANCER
# ============================================================
#
# Level 2 ingress component.
#
# The ELB is first created privately inside the dedicated
# edge subnet. Public exposure through a separate EIP will
# be added only after the ELB/backend path is validated.
# ============================================================

resource "hcs_elb_loadbalancer" "routepilot" {
  name        = "routepilot-elb"
  description = "Public application entry point for Route Pilot"

  vpc_id         = hcs_vpc.routepilot.id
  ipv4_subnet_id = hcs_vpc_subnet.edge.ipv4_subnet_id

  ipv4_eip_id = var.routepilot_elb_eip_id

  tags = {
    project = "routepilot"
    role    = "edge"
  }
}

# ============================================================
# HTTP LISTENER
# ============================================================

resource "hcs_elb_listener" "routepilot_http" {
  name            = "routepilot-http"
  loadbalancer_id = hcs_elb_loadbalancer.routepilot.id

  protocol      = "HTTP"
  protocol_port = 80
}

# ============================================================
# FRONTEND BACKEND POOL
# ============================================================

resource "hcs_elb_pool" "routepilot_frontend" {
  name        = "routepilot-frontend-pool"
  protocol    = "HTTP"
  lb_method   = "ROUND_ROBIN"
  listener_id = hcs_elb_listener.routepilot_http.id
}

# ============================================================
# FRONTEND SERVER
# ============================================================

resource "hcs_elb_member" "routepilot_frontend" {
  name          = "routepilot-frontend"
  pool_id       = hcs_elb_pool.routepilot_frontend.id
  address       = "10.100.1.10"
  protocol_port = 80

  subnet_id = hcs_vpc_subnet.frontend.ipv4_subnet_id
}

# ============================================================
# HEALTH CHECK
# ============================================================

resource "hcs_elb_monitor" "routepilot_frontend" {
  pool_id = hcs_elb_pool.routepilot_frontend.id

  protocol    = "HTTP"
  port        = 80
  url_path    = "/"
  interval    = 5
  timeout     = 3
  max_retries = 3
}


# ============================================================
# HTTPS LISTENER
# ============================================================
#
# TLS terminates at the ELB.
# Traffic from the ELB to the frontend remains HTTP on port 80.
# ============================================================

resource "hcs_elb_listener" "routepilot_https" {
  name            = "routepilot-https"
  loadbalancer_id = hcs_elb_loadbalancer.routepilot.id

  protocol      = "HTTPS"
  protocol_port = 443

  server_certificate = var.routepilot_elb_certificate_id

  http2_enable = true
}

resource "hcs_elb_pool" "routepilot_frontend_https" {
  name        = "routepilot-frontend-https-pool"
  protocol    = "HTTP"
  lb_method   = "ROUND_ROBIN"
  listener_id = hcs_elb_listener.routepilot_https.id
}

resource "hcs_elb_member" "routepilot_frontend_https" {
  name          = "routepilot-frontend-https"
  pool_id       = hcs_elb_pool.routepilot_frontend_https.id
  address       = "10.100.1.10"
  protocol_port = 80

  subnet_id = hcs_vpc_subnet.frontend.ipv4_subnet_id
}

resource "hcs_elb_monitor" "routepilot_frontend_https" {
  pool_id = hcs_elb_pool.routepilot_frontend_https.id

  protocol    = "HTTP"
  port        = 80
  url_path    = "/"
  interval    = 5
  timeout     = 3
  max_retries = 3
}