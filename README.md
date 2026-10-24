# Senku

**Don't just learn science. Do science.**

Senku is a biology-first learning platform built around reproducible experiments. Learners predict, manipulate, observe and explain, then open the same experiment in a laboratory with scientific results, visualizations and provenance.

## Status

The local application connects learner missions, four interactive science games, learning progress, scientific labs, real 3D result views, reaction-network composition, Gemini chat, source search, AI investigations, shared labs, private sharing, offline lesson synchronization and role-based classroom tools. Seven isolated scientific adapters execute approved educational models. See the [backend operating guide](docs/backend.md), [coverage](docs/backend-coverage.md) and [implementation status](docs/status.md) for evidence and limits.

Gemini is optional and uses local Google ADC, never committed credentials. Setup does not automatically provision Google Cloud resources. This is a functional local platform, not a claim of production deployment or empirical model validation.

| Surface | Route | Available behavior |
|---|---|---|
| Explore | `/` | Ten approved experiments and recent work |
| Learn | `/learn` | Missions, authoritative XP, mastery and achievements |
| Play | `/challenges` | Four live model games with server-verified device/server evidence |
| Lab | `/lab` | Runs, scientific scenes, comparisons, CSV/JSON/SBML and reproducibility exports |
| Research | `/discover` | Europe PMC papers, RCSB structures and cited investigations |
| Ask Senku | `/companion` | Explicitly summoned Gemini explanations with model/run context |
| Pathways | `/pathways` | Approved mass-action graph composition, compilation and real solver runs |
| Shared labs | `/rooms` | Authenticated live settings, roles, revision conflicts, shared runs and private invitations |
| Classroom | `/classroom` | Learner assignments; teacher/admin class creation, progress and exports |
| Offline | `/offline` | Prepared lesson reload, local evidence queue and server reconciliation |

## Requirements

Docker Desktop with Linux containers/WSL2 on Windows, or Docker Engine with Compose on Linux. The supplied scripts use PowerShell. Allow substantial disk space and time for native builds; local verification used approximately 8 GB Docker memory. Host Node.js and Python installations are not required for the Docker workflow.

## Start locally

From the repository root:

```powershell
.\scripts\setup.ps1
.\scripts\science.ps1
```

Setup generates unique local secrets if needed, builds the web/API and starts the nginx gateway, PostgreSQL, Redis and MinIO. The gateway serves the app, API proxy and websocket upgrades on port 3000. Setup includes the optional read-only ADC mount when Gemini is enabled and its ignored credential file exists. The science script builds isolated environments and molecular-editor dependencies using committed locks. Use -RefreshLocks only when intentionally updating Python resolution.

| Local interface | Address |
|---|---|
| Web | http://localhost:3000 |
| API health | http://localhost:3001/health |
| API documentation | http://localhost:3001/docs |
| MinIO console | http://localhost:9001 |

Local credentials are in ignored .env. Database, queue and science ports are not published to the host. The API and jobs run separately. Guests explore; accounts save progress; redeemed invitations permit remote compute. Authentication stays local and registration is enabled by default. The isolated editor dependency service still requires frontend integration.

## Verify

```powershell
.\scripts\verify.ps1
.\scripts\verify-science.ps1
.\scripts\test-backend.ps1 -LiveSources
docker compose --profile tools run --rm --no-deps tooling npm run typecheck
docker compose --profile tools run --rm --no-deps tooling npm audit --audit-level=moderate
```

The backend suite uses unique database/queue/storage namespaces and real solver containers. It covers authorization, concurrency, offline rewards, jobs, cancellation, collaboration, artifacts and investigations. Reference tests verify implementation behavior; they do not establish empirical biological validity. Live Gemini and production infrastructure still require real project credentials and deployment evidence.

## Linux and macOS

Create .env from .env.example and replace every secret placeholder with a distinct random secret. Then:

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
apps/web/                    Next.js learner, lab, research and classroom application
apps/api/                    NestJS API, jobs, migrations and integration tests
packages/experiment-schema/  Versioned experiment contract and local kernels
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
