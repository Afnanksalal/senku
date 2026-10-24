# Senku

**Don't just learn science. Do science.**

Senku is a biology-first learning platform built around reproducible experiments. Learners predict, manipulate, observe and explain, then open the same experiment in an advanced laboratory. The planned platform includes guided learning, free exploration, collaborative labs and evidence-grounded AI investigations.

## Status

The Docker dependency environment is installed and locally verified. Fourteen services passed health checks, alongside workspace type checks, dependency audits, scientific dependency smoke checks and database/queue/storage round-trips. The web and API are bootstrap scaffolds. Lessons, scientific adapters, authentication, collaboration, offline sync and AI workflows are not implemented yet.

See [implementation status](docs/status.md) and the [confirmed launch brief](docs/launch-brief.md). No GCP credentials are configured and no cloud resources are provisioned automatically.

## Requirements

Docker Desktop with Linux containers/WSL2 on Windows, or Docker Engine with Compose on Linux. The supplied scripts use PowerShell. Allow substantial disk space and time for native builds; local verification used approximately 8 GB Docker memory. Host Node.js and Python installations are not required for the Docker workflow.

## Start locally

From the repository root:

```powershell
.\scripts\setup.ps1
.\scripts\science.ps1
```

Setup generates unique local secrets if needed, builds the web/API and starts PostgreSQL, Redis and MinIO. The science script builds isolated environments and molecular-editor dependencies using committed locks. Use -RefreshLocks only when intentionally updating Python resolution.

| Local interface | Address |
|---|---|
| Web bootstrap | http://localhost:3000 |
| API health | http://localhost:3001/health |
| MinIO console | http://localhost:9001 |

Local storage credentials are in ignored .env. Database, queue and science ports are not published to the host. Scientific health services report execution_available=false until adapters exist; the editor dependency service reports editor_available=false.

## Verify

```powershell
.\scripts\verify.ps1
.\scripts\verify-science.ps1
docker compose --profile tools run --rm --no-deps tooling npm run typecheck
docker compose --profile tools run --rm --no-deps tooling npm audit --audit-level=moderate
```

Smoke checks exercise dependencies and small numerical fixtures, not validation of future Senku educational models. Recorded image identities and evidence are in [environment verification](docs/environment-verification.json).

## Linux and macOS

Create .env from .env.example and replace both password placeholders with distinct random secrets. Then:

```sh
docker compose up --build -d --wait
docker compose --profile science up --build -d --wait
docker compose exec -T api node scripts/check-infra.cjs
```

Use the committed Python dependency locks. The local stack is not an externally secured production deployment.

## Daily commands

```sh
docker compose ps
docker compose logs --tail 100
docker compose down
```

Named volumes retain data across normal shutdowns. Adding -v deletes them; use it only for an intentional local reset.

## Repository layout

```text
apps/web/                    Next.js web scaffold
apps/api/                    NestJS API scaffold
packages/experiment-schema/  Shared contract foundation
services/workers/            Eight scientific environments
services/molecule-editor/    Isolated React 18 / Ketcher dependencies
infra/docker/                Native/storage/lock-builder Dockerfiles
scripts/                     Setup and verification commands
docs/                        Product knowledge, architecture and decisions
Dockerfile                   Multi-stage Node tooling, web and API builds
compose.yaml                 Services, networks, volumes and profiles
```

The web/R3F application uses React 19; Ketcher's legacy viewer is isolated with React 18 and needs a separate browser-document integration. An installed library is not an integrated feature.

## Documentation

- [Knowledge base](docs/README.md)
- [Product](docs/product.md) and [architecture](docs/architecture.md)
- [Scientific integrity](docs/science.md) and [contracts](docs/contracts.md)
- [Decisions](docs/decisions.md) and [roadmap](docs/roadmap.md)
- [Docker setup](docs/setup.md) and [dependency selections](docs/dependency-selection.md)
- [Secrets and Google configuration](docs/configuration.md)
- [Agent instructions](AGENTS.md)
- [Original masterplan](docs/source/Senku_Detailed_Plan.md)

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). Never commit API keys, .env, credential files or generated dependencies. Google authentication and the invitation-only cloud budget are the next integration steps.

## License

Original Senku code is available under the [MIT License](LICENSE). Dependencies, scientific tools, data and assets retain their respective licenses. See [third-party notices](THIRD_PARTY_NOTICES.md).
