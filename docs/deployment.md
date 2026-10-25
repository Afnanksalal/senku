# Public Docker deployment

This guide deploys Senku with its dedicated TLS ingress. Verify the selected SSH host, existing workloads and free ingress ports before changing the server. Do not remove unrelated workloads without explicit authorization. Runtime deployment evidence belongs in `status.md`; configuration files alone do not establish a working deployment.

## Host and origin

Choose a stable public IPv4 address and a dedicated name such as `senku.<public-ip-with-hyphens>.sslip.io`. Verify DNS resolves to the selected server. The example is a format, not an assigned hostname. Set these non-secret values in the server's ignored `.env`:

```dotenv
SENKU_HOST=your-exact-hostname.sslip.io
SENKU_SITE_URL=https://your-exact-hostname.sslip.io
```

The URL must be an exact HTTPS origin, without a trailing slash. Rebuild web when it changes. Canonical URLs, sitemap, social images and installation metadata use this origin. Only the ingress needs public ports 80 and 443. Database, queue, object store, editor and scientific workers retain private networks; gateway/API/storage console host bindings remain loopback-only.

Inspect available RAM, disk, CPU, architecture, open ports and existing Docker projects before building. Scientific image builds need substantial disk and memory. Build serially on a constrained shared host, or transfer verified images of the matching architecture. Do not prune unrelated images, stop other applications, or replace their configurations to make room.

## Configuration and first boot

Generate separate random database/storage passwords and execution/signing keys using the Linux instructions in [setup.md](setup.md). Store `.env` with owner-only permissions. Preserve existing secrets and volumes on updates. Never print resolved Compose configuration containing credentials into logs or issue reports.

Use the same Compose project name and file list for every operation:

```sh
docker compose -f compose.yaml -f compose.production.yaml --profile science build
docker compose -f compose.yaml -f compose.production.yaml up -d --wait postgres redis minio
docker compose -f compose.yaml -f compose.production.yaml run --rm --no-deps api node apps/api/dist/cli.js migrate
```

Provision the private artifact bucket before starting API/jobs. An operator can create it with a one-shot SDK command using the existing API image and the configured private object store. Production runtime has `AUTO_MIGRATE=false` and `S3_CREATE_BUCKET=false`: application startup only verifies them. Do not turn those gates off to bypass failed provisioning. Use distinct migration and runtime database roles with schema verification and DML privileges when provisioning a hardened installation; the base Compose database owner remains the local bootstrap identity.

If the connected service uses ADC, add `-f compose.gemini.yaml` to the file list for API/jobs. Mount only the credential JSON, read-only, readable by the non-root application UID. Keep it outside images, source archives and backups intended for sharing. Prefer workload identity or appropriately scoped service credentials for durable hosting; a developer ADC can expire or be revoked.

```sh
docker compose -f compose.yaml -f compose.gemini.yaml -f compose.production.yaml --profile science up -d --wait
```

Local authentication remains enabled. Expensive work still requires an invitation budget. Provision an existing registered account through the operator CLI as described in [setup.md](setup.md#accounts-and-compute-access). Never grant anonymous public requests unlimited compute. `GLOBAL_DAILY_UNITS` and invitation limits are application allowances, not monetary billing controls.

## TLS ingress

`compose.production.yaml` adds a digest-pinned Caddy ingress on ports 80 and 443. Its `infra/Caddyfile` routes the exact `SENKU_HOST` to `senku-gateway:8080` on the private app network. Persisted `caddy-data` and `caddy-config` volumes retain certificate state through container recreation. The root filesystem is read-only, privileges are restricted and ingress logs rotate. Do not run this ingress while another service owns the same public ports. A host already sharing an ingress needs a deliberate configuration adaptation rather than a competing listener.

Validate the Caddy configuration before startup or reload. Caddy obtains and renews public certificates and redirects HTTP to HTTPS when DNS and ports are reachable. See [automatic HTTPS](https://caddyserver.com/docs/automatic-https) and [proxy header behavior](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#headers).

The production nginx config trusts the ingress-supplied scalar `X-Forwarded-For` and sets the original HTTPS scheme. The Caddy fragment overwrites client-supplied forwarding values with the actual connection address; API trusts one gateway hop. Do not publish the gateway directly to untrusted clients or place an unconfigured proxy ahead of Caddy. This avoids every visitor sharing the ingress rate-limit identity and prevents forwarded-header spoofing. The existing WebSocket and streaming routes remain unchanged.

## Verification before release

Run the isolated backend/native suite and browser checks before publishing the source commit. After deployment, verify the actual public origin, not only loopback:

- Valid publicly trusted TLS, HTTP redirect, expected hostname and unchanged neighboring sites.
- `/backend/health` and `/backend/ready`, all expected workers healthy, no public database/queue/storage/editor ports.
- Registration, login, refresh, logout and account isolation; invited compute and quota denials.
- Actual scientific jobs, cancellation, artifacts/hashes/provenance, molecular drawing/import/export and a completed multi-pair comparison.
- Connected question routing, personalized learning, dynamic games, chat and scoped research with real provider responses. Keep tests small and disclose charges.
- Two-client shared-room WebSockets, learning/XP reconciliation, saved pathways, profile persistence and classroom permissions.
- Desktop/mobile layouts, real 3D plus 2D fallback, PWA manifest/service worker/installation conditions and prepared offline lessons.
- Canonical/social metadata, raster preview images and sitemap reference the public origin; private pages remain unindexed and private responses uncached.
- Restart persistence, bounded service health, safe logs and a recovery exercise using fresh database/bucket resources.

Use temporary test accounts and a dedicated bounded budget, then delete them and disable the budget. Do not alter existing learner accounts or claim untested physical-device, clinical or load certification.

The operator-only public API verifier runs inside the API container and makes its HTTP/WebSocket requests through the configured public HTTPS origin. It requires an explicit acknowledgement and uses actual workers and the connected provider, with a dedicated 40-unit temporary allowance:

```sh
docker compose -f compose.yaml -f compose.gemini.yaml -f compose.production.yaml exec -T \
  -e SENKU_PUBLIC_ACCEPTANCE=true -e SENKU_TEST_URL=https://your-exact-hostname.sslip.io \
  api node scripts/verify-deployment.cjs
```

Run a failed section independently with `-e SENKU_TEST_SECTIONS=research`, or select a comma-separated list from `core,molecules,ai,research,collaboration`. Each invocation creates and cleans its own test accounts. Successful sections should not be repeated merely to hide a transient failure; record both the failure and subsequent result. Logs exclude authentication tokens and generated private content.

The manual **Public deployment verification** GitHub workflow checks the real public origin from an independent runner. It exercises responsive pages, HTTPS canonical/social metadata, crawler previews, PWA/offline fallback, real molecular drawing and navigation cleanup. It creates no paid operations and receives no VPS or cloud credentials. Review its uploaded browser evidence alongside the normal backend verification workflow. Neither workflow automatically deploys source changes.

## Updates and recovery

Record the deployed Git SHA, image identities, Compose file list and non-secret public origin. Before updating, take a coordinated private database/artifact backup following [backend.md](backend.md#verification-and-recovery). Never use `down -v` during normal deployment. Keep rollback images and snapshots until the updated app passes its public smoke tests. After service recreation, verify gateway routing; its dynamic Docker resolver should pick up changed upstream addresses.

Schedule retention and backups with restricted access, encrypted off-host copies and periodic isolated restore verification. On-host persistent volumes protect against container recreation, not server loss. External uptime alerts, cloud billing alerts and capacity/load targets remain separate operator setup.
