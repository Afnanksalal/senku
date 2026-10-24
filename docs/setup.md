# Docker setup

The supported local workflow runs the application, API, job process, data services and scientific workers in Docker. See [runtime configuration](configuration.md) for cloud authentication and [backend operations](backend.md) for deployment settings.

## Requirements

Use Docker with Compose v2 and Linux containers. Windows needs Docker Desktop with WSL2. Windows helper commands use PowerShell; on Linux, use the Compose commands below. Native scientific builds require substantial disk space and download/build time. The full local stack has been exercised with about 8 GB available to Docker. Host Node.js and Python are not needed to build or run the containers.

## Windows

From the repository root:

```powershell
./scripts/setup.ps1
./scripts/science.ps1
```

`setup.ps1` creates ignored `.env` from `.env.example` when it does not exist, generating four distinct random secrets. It builds and starts the gateway, web, API, jobs, PostgreSQL, Redis and MinIO. Existing `.env` values are preserved; missing execution/signing keys are added.

`science.ps1` builds a Linux dependency-lock helper, preserves committed locks by default, and starts the science profile. Use `-RefreshLocks` only for a deliberate dependency update. It starts eight simulation adapters and the BioSimulators utility environment; installing that utility does not make it a simulator. The separate molecule-editor dependency service is not a completed editor integration.

## Linux

For a fresh clone, generate local secrets with OpenSSL. This block preserves an existing `.env`:

```sh
if [ ! -f .env ]; then
  umask 077
  cp .env.example .env
  for key in POSTGRES_PASSWORD MINIO_ROOT_PASSWORD SCIENCE_TOKEN OFFLINE_SIGNING_KEY; do
    value=$(openssl rand -hex 32)
    sed -i "s/^${key}=REPLACE_WITH_RANDOM_SECRET$/${key}=${value}/" .env
  done
fi

docker compose up --build -d --wait
docker compose --profile science up --build -d --wait
```

Do not reuse a password across the database, object store and application keys. Keep `.env` private. On macOS, create the same four distinct values in `.env` manually or use compatible shell tools before running the Compose commands; the `sed -i` example above targets Linux.

## Local interfaces

| Service | Address |
| --- | --- |
| App and same-origin API gateway | http://localhost:3000 |
| API health | http://localhost:3001/health |
| API documentation | http://localhost:3001/docs |
| Local object-store console | http://localhost:9001 |

Only localhost interfaces are published. Scientific workers have no host ports and communicate on an internal compute network. The gateway forwards authenticated HTTP and WebSocket traffic. The API and jobs are separate processes.

Database and object-store credentials are in ignored `.env`; there are no shared default passwords. The root filesystem of runtime services is read-only, with temporary workspaces and bounded resources. This setup is for local operation, not a completed public deployment.

## Accounts and compute access

Guests can inspect the catalog and use supported device/practice paths. Register a local account to retain cloud progress. Remote scientific jobs and connected Senku features require an active invitation budget; cloud credentials alone do not grant a learner compute access.

For a new local installation:

1. Register an account in the application or through `/v1/auth/register` in the local API documentation. Its account UUID is available from the registration response or authenticated `/v1/me`.
2. Provision that existing account from the operator terminal:

   ```sh
   docker compose exec api node apps/api/dist/cli.js admin <account-uuid>
   ```

3. As that administrator, use the authenticated API documentation to create a budget with `POST /v1/admin/budget-groups`, then issue an expiring invitation with `POST /v1/admin/invitations`.
4. Redeem the returned code from the learner's profile, or with `POST /v1/invitations/redeem`.

There is no HTTP self-promotion endpoint. Invitation codes are returned once and stored as hashes. Keep them private. A compute unit is an application allowance, not a live currency balance or a guarantee of provider credit eligibility.

## Connect the companion

The repository defaults to `ENABLE_GEMINI=false` so a clone can start without cloud credentials. This does not fabricate generated content: connected mission preparation, natural question routing, conversation and narration require the configured service. Practice and supported local models retain their separate labels.

Use [runtime configuration](configuration.md) to choose a project, location and model and authenticate through ADC. The local override mounts only `.secrets/gcloud/application_default_credentials.json`, read-only, into API and jobs:

```sh
docker compose -f compose.yaml -f compose.gemini.yaml up -d api jobs
```

On Windows, `setup.ps1` includes that override automatically when the credential file exists and `.env` enables it. Subsequent recreation of API/jobs must retain the override if the local connection relies on that mount. Do not copy credentials into an image.

## Verification

```powershell
./scripts/verify.ps1
./scripts/verify-science.ps1
./scripts/verify-docking.ps1
./scripts/test-backend.ps1
```

```sh
docker compose --profile tools run --rm --no-deps tooling npm run typecheck
```

Infrastructure and dependency checks do not establish biological validity. The backend suite uses isolated database/queue/storage namespaces. Add `-LiveSources` for real external paper/structure checks. Live explanation checks require an explicitly configured project and should be reported separately from substituted-provider tests.

## Daily operation and troubleshooting

```sh
docker compose ps
docker compose logs --tail 100 api jobs web
docker compose down
```

Named volumes survive normal shutdown. Do not add `-v` unless deliberately deleting local data. Back up important work using the [operating guide](backend.md).

After recreating web or API containers, restart the gateway if its upstream address is stale:

```sh
docker compose restart gateway
```

If a model is unavailable, confirm its science worker is healthy. A healthy API does not imply every optional worker is running. If generated content is unavailable, check provider configuration and learner admission independently. Do not put diagnostic output containing credentials into public issues.

The Node workspace lock and per-worker Linux/Python locks own dependency resolution. Avoid resolving native science dependencies against Windows or introducing host `node_modules` into container builds. Public hosting additionally needs real TLS, operator identities, backups, monitoring and workload verification.
