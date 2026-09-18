provider "hcs" {
  region       = "ma-gbs-1"
  project_name = "ma-gbs-1_INTERNSHIP"
  cloud        = "gbscloud.ma"

  access_key = var.hcs_access_key
  secret_key = var.hcs_secret_key

  insecure = true
}