# Docker development setup

This installs infrastructure and dependency readiness scaffolding, not the full platform. Web/API only expose bootstrap pages and health endpoints. Science containers import libraries and report readiness; execution_available is false until typed adapters are implemented.

## Commands

Start Docker Desktop with Linux/WSL2 backend. From the repository run `./scripts/setup.ps1` to build and start core services. Web: http://localhost:3000. API health: http://localhost:3001/health. MinIO console: http://localhost:9001. Credentials are generated locally in ignored .env; never publish them.

Run `./scripts/science.ps1` to use the committed hash-locked Linux/Python 3.11 dependency files and build independent numerics, RDKit, COBRApy, RoadRunner, Tellurium and BioSimulators utility environments. These workers have no published ports, are non-root/read-only, have bounded resources and use an internal network. BioSimulators utilities do not by themselves constitute a simulator adapter. COPASI has an isolated Python-binding image; PhysiCell builds its upstream template at pinned commit dbd3499250141b27600e91e501c54c46f68f2763. Both require build/import verification and scientific adapter implementation.

Use `docker compose ps`, `docker compose logs`, and `docker compose down` to inspect or stop the stack. Do not use `down -v` unless deliberately deleting local data. No GCP project is configured, no cloud resources provisioned, and no credit is spent by this setup. ADC/service identity and invitation/quota policies must be implemented before real AI usage.

The Node workspace lockfile records exact resolution. npm libraries are installed but not all imported by bootstrap screens. Scientific locks are created by the Linux lock builder, not resolved against Windows. Retrieved infrastructure/base digests are pinned where configured; built local image IDs and verification evidence are recorded in environment-verification.json. This is a local development stack, not an externally secured production deployment.

## Verification and development tools

Run `./scripts/verify.ps1` for HTTP health, PostgreSQL, Redis/BullMQ and S3 round-trips. Run `./scripts/verify-science.ps1` for library/solver smoke checks. These are environment checks, not scientific validation of Senku lessons.

Use `docker compose --profile tools run --rm --no-deps tooling npm run typecheck` for workspace checks inside Docker. Regenerate Python locks deliberately with `./scripts/science.ps1 -RefreshLocks`; normal startup preserves committed locks. The isolated Ketcher dependency service has its own React 18 lockfile and reports editor_available=false until its UI is implemented. The web scaffold also explicitly says the platform is not implemented.

Main and editor lockfiles were resolved independently to avoid peer conflicts. Any host node_modules left from initial package resolution are not used by Docker builds or runtime. Use the Docker commands as the supported environment.
