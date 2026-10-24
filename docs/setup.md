# Docker development setup

The Docker workflow now builds the implemented backend, separate jobs process and isolated scientific adapters. See backend.md for the account/invitation flow, canonical API, production guards and verification limits. Frontend work remains separate.

## Commands

Start Docker Desktop with Linux/WSL2 backend. From the repository run `./scripts/setup.ps1` to build and start core services. Web: http://localhost:3000. API health: http://localhost:3001/health. MinIO console: http://localhost:9001. Credentials are generated locally in ignored .env; never publish them.

Run `./scripts/science.ps1` to use the committed hash-locked Linux/Python 3.11 dependency files and build independent numerics, RDKit, COBRApy, RoadRunner, Tellurium and BioSimulators utility environments. These workers have no published ports, are non-root/read-only, have bounded resources and use an internal network. BioSimulators utilities do not by themselves constitute a simulator adapter. COPASI has an isolated Python-binding image; PhysiCell builds its upstream template at pinned commit dbd3499250141b27600e91e501c54c46f68f2763. Their approved educational adapters now execute bounded jobs and have native reference checks.

Use `docker compose ps`, `docker compose logs`, and `docker compose down` to inspect or stop the stack. Do not use `down -v` unless deliberately deleting local data. No GCP project is configured, no cloud resources provisioned, and no credit is spent by this setup. Invitation/quota policies are enforced. Optional Vertex ADC/service identity, explicit model access and live provider verification are still required before enabling real AI usage.

The Node workspace lockfile records exact resolution. npm libraries are installed but not all imported by bootstrap screens. Scientific locks are created by the Linux lock builder, not resolved against Windows. Retrieved infrastructure/base digests are pinned where configured; built local image IDs and verification evidence are recorded in environment-verification.json. This is a local development stack, not an externally secured production deployment.

## Optional Google Gemini connection

The selected development project is `project-f262e754-ce96-4f0c-b24`; the selected model is `gemini-4-argon` at `global`. Its organization policy disallows API keys. Use `./scripts/gemini-login.ps1` to sign in through the pinned Google CLI Docker image. Complete Google's consent screen yourself and enter its authorization code only in the local terminal. Credentials stay in ignored `.secrets/gcloud/` and are excluded from Docker build context.

After credentials and model access are verified, set `ENABLE_GEMINI=true` in the ignored `.env` and run `docker compose -f compose.yaml -f compose.gemini.yaml up -d api jobs`. This optional override mounts only the ADC JSON read-only into those two services. Ordinary Compose startup requires no Google credentials. Google credentials authenticate the provider only; Senku accounts continue to use local authentication. Never commit credentials or paste authorization codes into chat.

## Verification and development tools

Run `./scripts/verify.ps1` for HTTP health, PostgreSQL, Redis/BullMQ and S3 round-trips. Run `./scripts/verify-science.ps1` for library/solver smoke checks. These are environment checks, not scientific validation of Senku lessons.

Use `docker compose --profile tools run --rm --no-deps tooling npm run typecheck` for workspace checks inside Docker. Regenerate Python locks deliberately with `./scripts/science.ps1 -RefreshLocks`; normal startup preserves committed locks. The isolated Ketcher dependency service has its own React 18 lockfile and reports editor_available=false until its UI is implemented. The backend suite is scripts/test-backend.ps1; add -LiveSources for real provider retrieval checks.

Main and editor lockfiles were resolved independently to avoid peer conflicts. Any host node_modules left from initial package resolution are not used by Docker builds or runtime. Use the Docker commands as the supported environment.

## Current local provider and gateway
The running local stack has a verified ADC Gemini connection. General repository defaults still start with Gemini disabled. The nginx gateway is the public web entry on localhost3000 and forwards authenticated HTTP and websocket connections; Next itself is internal. Use scripts/setup.ps1 for restart: it includes compose.gemini.yaml automatically when enabled ADC exists. See status.md for live provider, game, offline and collaboration verification.
