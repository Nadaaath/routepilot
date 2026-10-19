# Deployment and operations

[← Back to README](../README.md)

## Local development with Docker Compose

Use Docker Compose to run a local three-service application, **not** to provision Huawei Cloud Stack resources.

```bash
git clone https://github.com/Nadaaath/routepilot.git
cd routepilot
cp backend/.env.example backend/.env
# Edit backend/.env: use your own ORS_API_KEY
docker compose up --build -d
docker compose ps
```

Open http://localhost:8081 and check http://localhost:8081/api/health. The local frontend publishes port 8081 and proxies `/api/` to the backend service on port 5000. PostgreSQL 17 runs as a container with a named volume. The Compose backend command executes `prisma migrate deploy` at startup.

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```

**Security note:** `docker-compose.yml` uses a demonstration database password; change it before any shared or internet-accessible deployment. The local environment is not a production security baseline. Never commit personal API keys or a populated `.env`.

## HCS provisioning and configuration

Infrastructure definitions are under `infrastructure/terraform`; host configuration lives under `infrastructure/ansible`.

The intended workflow is:

1. Prepare an authorized HCS project, provider access, VM SSH credentials and network allocations.
2. Inspect the Terraform provider variables and **review the existing infrastructure state** before any apply.
3. Run `terraform fmt -check`, `terraform validate` and `terraform plan` with appropriate credentials and a securely managed state backend.
4. Reconcile older/experimental Terraform resources against the deployed HCS environment *before* applying a plan.
5. Configure application hosts using `ansible-playbook playbooks/baseline.yml` and `ansible-playbook playbooks/configure.yml` from `infrastructure/ansible` with authorized SSH access.
6. Let Jenkins deploy the versioned GHCR images using `playbooks/deploy.yml`.

These are operator procedures, not copy-and-paste provisioning guarantees: HCS tenants, network routes, provider capabilities, firewall permissions, vault variables and inventories must all be configured for the destination environment.

### Terraform caveat

The tree still contains `elb.tf` and related variables/outputs from an earlier iteration. The validated public access path for RoutePilot was **NAT DNAT to the frontend**, rather than an ELB. Before running Terraform, remove or isolate resources that are no longer part of the deployment **after checking state**, to avoid accidental creation or destruction. `nat.tf` refers to the **edge subnet** for the NAT Gateway, but an older comment mentions the database subnet; that comment should be cleaned up.

### Ansible caveats

- The inventory uses environment-specific private IPs. Replace it when targeting a different VPC.
- Ansible Vault is used for encrypted configuration, but vault passwords and decrypted contents must never be committed.
- The Jenkins-to-Ansible deployment passes image tags and registry credentials via environment variables; the runner and its credentials configuration must be checked before execution.
- Some playbooks target a monitoring host that must be reachable from the control node. Test `ansible all -m ping --ask-vault-pass` with authorized SSH credentials before deploying.

## Health verification

The Express API has separate endpoints:

| Endpoint | Purpose |
| --- | --- |
| `/health` | Process-level HTTP health response |
| `/ready` | Checks PostgreSQL connectivity; returns 503 if unavailable |
| `/metrics` | Prometheus metrics |

On HCS, the API is proxied from the frontend's `/api/` path to the private backend on port 8000. The Jenkinsfile additionally runs remote and public HTTP checks, but check the actual output of the run instead of assuming that presence of a pipeline stage proves a successful live deployment.

## Troubleshooting

| Symptom | Inspect |
| --- | --- |
| Page loads but API calls fail | Nginx `/api/` upstream, backend port and backend SG ingress |
| Backend cannot start | Container logs, `DATABASE_URL`, required API key, Prisma migrations |
| Backend cannot reach PostgreSQL | Database SG, DB service bind address, `pg_hba.conf`, credentials |
| Deployment cannot reach a host | Bastion SSH path, Ansible inventory, SSH agent/key, vault access |
| Metrics target is down | Prometheus targets, exporter service, monitoring SG and scrape port |
| Compose frontend not reachable | `docker compose ps`, port 8081 and frontend logs |

## Operational and security limitations

This is a reference engineering environment, not a ready-made publicly deployable Terraform module. Avoid using committed public IP addresses, passwords, API-key values, HCS access settings or infrastructure state as defaults. Database backup/restore, high availability, TLS termination and disaster-recovery procedures have not been demonstrated by the checked-in automation. Update operational credentials and security settings before any public exposure.
