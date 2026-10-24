# Backend implementation and operating guide

Senku now has a NestJS backend, PostgreSQL source of truth, Redis/BullMQ job transport, private S3-compatible artifacts and seven isolated scientific adapters. The frontend is a separate workstream. This document describes implemented behavior; it does not certify a public deployment or empirical biological validity.

## Local operation

Run `scripts/setup.ps1`, then `scripts/science.ps1`. The core services include a separate `jobs` process. Open `http://localhost:3001/docs` for generated OpenAPI and `http://localhost:3001/openapi.json` for its machine-readable form. `/health` is process liveness; `/ready` requires PostgreSQL, Redis, the artifact bucket and a recent worker heartbeat. Science availability is separately inspectable by an administrator at `/v1/admin/operations/engines`.

Local Compose defaults to development mode, migrations/catalog seeding and local registration. The latest user direction is to keep auth local and simple and prioritize functional integration over additional production hardening. Secrets are generated into ignored `.env`; existing installations receive missing execution/signing secrets. External deployment settings are optional follow-up work; no external identity service is required. Guests may inspect catalogs and obtain offline packs; accounts are required for durable progress, rooms and expensive remote execution. Guest registration upgrades preserve the account ID. A guest does not automatically receive compute credits.

Register an account through `/v1/auth/register` then provision its existing UUID using `docker compose exec api node apps/api/dist/cli.js admin <uuid>`. There is no HTTP self-promotion endpoint. An administrator creates a budget group and expiring invitation; a learner redeems it before submitting remote work. Invitation and share tokens are returned once and stored as hashes.

## API map

| Area | Main routes |
|---|---|
| Identity | `/v1/auth/guest`, `/register`, `/login`, `/refresh`, `/logout`; `/v1/me` |
| Catalog | `/v1/subjects`, `/lessons`, `/experiments`, `/engines`, `/models` and version routes |
| Learning | `/v1/learning/attempts`, `/v1/lessons/:lesson/attempts`, `/v1/me/progress`, `/v1/challenges/:id/attempts` |
| Offline | `/v1/offline/packs/:lesson`, `/v1/offline/sync`, alias `/v1/sync/events` |
| Computation | `/v1/runs`, `/v1/runs/:id/{cancel,artifacts,diagnostics,reproducibility,events}` |
| Artifacts | `/v1/runs/:id/artifacts/:artifact/content` |
| Sweeps | `/v1/simulation-batches`, `/:id`, `/:id/cancel` |
| Pathways | `/v1/pathways/validate`, `/compile`, `/:id` |
| Molecules | `/v1/molecules/validate`, `/describe`, returning asynchronous run references |
| Sources | `/v1/sources/papers`, `/v1/sources/structures/:id`, `/v1/sources/records/:id` |
| Structures | `/v1/structures/search`, `/:id`, `/:id/file` |
| Investigations | `/v1/investigations`, `/:id`, `/:id/cancel`, `/:id/events`, `/:id/stream` |
| Companion | Explicitly summoned `/v1/companion/respond`; configured Gemini required |
| Collaboration | `/v1/rooms`, room state, edits, members and durable events |
| Sharing | `/v1/shares`, `/v1/shared/:token`, `/v1/shared/:token/join` |
| Classrooms | `/v1/classrooms`, joins, assignments, membership and authorized teacher progress |
| Operations | `/v1/admin/budget-groups`, `/invitations`, `/operations/{metrics,engines}`; `/v1/me/usage` |

POSTs creating runs, batches, rooms, compiled pathways, investigations and companion answers require `Idempotency-Key` (8 to 128 allowed characters). Reusing a key with different validated input returns 409. Run/batch/molecule submission returns 202. Other creation routes return 201. Validation errors carry safe field paths and codes; internal SQL, credentials and stacks are not returned.

## Persistence and scientific execution

Migrations are ordered and checksum-verified. Model and experiment definitions are immutable per version; lessons are checked on seed. Runs store validated parameters, experiment/model/adapter versions, seed, status, timestamps, engine version, diagnostics and artifact hashes. Generated solver output is retained as a hashed private artifact. The artifact endpoint checks ownership or active room membership and verifies downloaded bytes. Reproducibility exports include approved pathway input and the exact manifest.

Submitting a job atomically reserves quota, inserts the run and appends an outbox entry. A dispatcher sends durable entries to BullMQ. Queue jobs use stable run IDs. Redis can be rebuilt: pending database runs and investigations are reconciled back into their queues. Terminal database states suppress duplicate execution and duplicate artifact attachment. Infrastructure failures receive at most three attempts. Work waiting more than 15 minutes is rejected rather than executing an old backlog; interrupted runs older than five minutes and investigations older than 15 minutes expire explicitly on recovery. Domain/input failures terminate directly.

The run lifecycle is queued, running, then completed, failed, cancelled or timed_out. Queued cancellation releases its reservation. Started computations consume their allowance, including failed attempts; this prevents free retry abuse. A quota unit is a bounded admitted operation, not a dollar amount or a live GCP billing balance. Group/member/global daily limits use the server UTC day. Cloud billing alerts and project budgets are separate deployment controls.

Workers accept only fixed model identifiers and typed input. They have no public ports or Docker socket, use an internal compute network, and run non-root with a read-only root filesystem, dropped capabilities, CPU/memory/PID caps and a 256 MiB temporary workspace. Each execution has its own process group and directory, bounded CPU/address space/files/descriptors, a wall deadline and 4 MiB output limit. Cancellation terminates and reaps the process group. Credentials are removed from the execution subprocess environment. Arbitrary scripts, model files, images and fetch URLs are not accepted.

Implemented models: normalized limiting-resource energy index; Michaelis-Menten substrate/product kinetics; logistic growth; seeded Mendelian sampling; conservative no-flux 2D diffusion; illustrative ecosystem ODEs; approved mass-action networks through RoadRunner/Tellurium/COPASI; toy COBRA flux balance; bounded RDKit descriptors/ETKDG conformers; pinned upstream generic PhysiCell colony. All are labeled `illustrative_educational`. Pathway SBML declares mmol, litres, minutes and reaction-order-dependent rate units. BioSimulators utilities remain utilities, not a simulation adapter.

Each successful run records the adapter source SHA-256. Set the actual deployed `WORKER_IMAGE_DIGEST` on each compute service to record its image identity. Local builds leave image_digest null rather than inventing it. Deploy immutable image digests and retain their registry artifacts for stronger reproducibility.

## Learning and offline guarantees

The server recomputes approved local kernels or reads a completed owned run. It scores the lesson assessment, records a reflection/prediction and awards versioned lesson XP once. Mastery and achievements are transactional. Challenge scoring uses actual completed-run quantities. XP is never accepted from the client. Educational scoring does not establish that an untrusted client physically performed an experiment.

Offline packs contain versioned lesson/model data, a server signature and a 30-day expiration. Synchronization accepts at most 50 local-evidence events atomically. Unique account/event IDs prevent duplicate credit and reject conflicting reuse. Packs cannot be changed without breaking their signature. The shared numerical kernels live in `packages/experiment-schema`; browser caching/service-worker integration remains frontend work. Streaks use server acceptance dates in UTC, which prevents forged historical activity.

## Collaboration and evidence

Rooms persist experiment/version, parameters and a monotonically increasing version. Edits require the expected version; conflicting edits return 409. Shared runs require the exact current room parameters and version. Owners/editors can edit and submit/cancel shared work; viewers can inspect it. Room membership is rechecked on operations. Removing a member removes their room access. Revoking a share link prevents future link use; it does not remove already joined members. Room owners can explicitly remove those members or close the room.

Socket.IO uses the `/collaboration` namespace, WebSocket transport, exact approved Origin and handshake auth `{token, room_id, after}`. Tokens never belong in a URL. `room.snapshot` supplies current state, `room.edit` accepts `{expected_version, parameters}`, and `room.event` carries a durable sequence. Clients reconnect from their last sequence and deduplicate by it. The snapshot is authoritative: apply parameter events only when their version is newer than the current room version; older replayed updates are history. Every API instance reads the same PostgreSQL event log on a 500 ms bounded poll, so fanout does not depend on process-local room state. Session revocation/expiry and membership removal disconnect clients. Each instance allows at most five active sockets per account; infrastructure must bound total connections at the ingress.

Investigation events support bounded JSON replay at `/:id/events?after=sequence`. SSE is `/:id/stream`, with `Last-Event-ID`, heartbeats, bounded replay, at most three concurrent streams per account across API instances, and a 15-minute maximum connection. The reader rechecks authentication on every poll. Reconnect after retention requires fetching a fresh investigation snapshot.

Investigations execute a persisted task DAG: planning, optional bibliographic retrieval, actual queued sweep, exact result extraction, explicit critique and report. Supply approved `runs` for deterministic execution, or enable configured AI and set `use_ai=true` without runs to request automatic planning. Gemini may select at most eight typed runs from the published catalog; server validation rejects unknown models, out-of-bounds values and private room/pathway identifiers before dispatch. The accepted plan is persisted and reused on recovery. Automatic custom-pathway selection is excluded; provide an owned compiled pathway explicitly in a user-authored run request. Failures never produce invented quantities. Each task state/event reflects work actually performed. Without requested AI, reports are deterministic. Optional Gemini narrative is labeled AI-generated and requires review; authoritative numbers remain in the separately recorded facts. Citation identifiers must exist among retrieved sources. The companion responds only to an explicit request and suggests only approved parameter names. Its failed provider attempts still consume a quota unit. Companion admission and the provider claim are persisted before calling Gemini, with at most two active requests per account and four globally. The database connection is released during the provider call. Retry the same key to retrieve its stable response record; `/v1/companion/responses/:id` also retrieves it. Ambiguous interrupted requests become failed after two minutes and are not automatically billed again under that key. Investigations can retry after worker failure; application job idempotency is not a provider billing guarantee.

Europe PMC and RCSB use fixed HTTPS hosts, no redirects, bounded response sizes/timeouts and encoded queries. Literature search uses the provider cursor: supply `q`, `limit` and optional `cursor`, then follow `next_cursor`. Structure metadata/download supports legacy four-character PDB IDs; oversized or other identifier families are rejected explicitly. Bibliographic metadata is not proof that a paper supports a claim. Structure files are capped at 4 MiB, cached privately with hashes and served through an authenticated download. Retrieved text is untrusted data and never becomes executable instructions. Provider API references: [Europe PMC](https://europepmc.org/RestfulWebService), [RCSB Data](https://data.rcsb.org/), [RCSB Search](https://search.rcsb.org/).

## Identity and privacy

Local identities use scrypt passwords, random hashed opaque tokens, 15-minute account access tokens and rotating refresh families. Refresh-token replay revokes the family. Logout/all-session revocation is checked on subsequent HTTP/socket/SSE access. Authentication is local only. There is no Firebase dependency, token exchange or identity-project requirement. Registration can be enabled in any environment; accounts are email/password plus the existing local session flow.

Teacher progress includes only matching lesson attempts made after both enrollment and assignment creation. Joining a class does not expose earlier private attempts. Account export is authenticated and capped at 10,000 records per collection, with an explicit truncation flag. Larger exports require an operator-assisted database export. Deletion immediately revokes sessions/links, closes owned rooms/classes and requests cancellation. Maintenance removes artifacts and personal lesson/pathway/workflow content after active work stops. Tombstone UUIDs and bounded operational/quota records remain for integrity and abuse accounting. Backup copies expire under the operator's backup policy; deletion is not a promise to rewrite existing backup archives.

## Production deployment

Use `NODE_ENV=production`, `AUTH_MODE=local`, `ALLOW_LOCAL_REGISTRATION=true`, `AUTO_MIGRATE=false`, `S3_CREATE_BUCKET=false`, exact HTTPS `CORS_ORIGINS`, explicit trust-proxy configuration and independently provisioned secrets. Startup rejects incompatible settings. Provision the private bucket separately. Run `node apps/api/dist/cli.js migrate` as a deployment job using migration privileges. API/jobs runtime only verify migration checksums; use separate database roles without schema-creation privileges. Grant DML/sequence access only on the Senku schema. Do not enable public bucket policies.

Use TLS at the ingress, private database/Redis/S3 connections, workload identity or a read-only ignored ADC mount for both API and jobs, and least-privilege Vertex permissions. Gemini additionally requires explicit project, location, model and `ENABLE_GEMINI=true`. Credentials and model access have not been supplied or live-tested. Configure billing alerts and service quotas before enabling it. The repository provisions no GCP resources.

Liveness/readiness, safe request logs with correlation IDs, durable audit/events and administrator metrics are implemented. Central log retention, external alerting, geographic privacy policy, minors' consent obligations, production load/SLOs and deployment TLS/identity tests require the actual operator environment. The API/jobs runtime images contain compiled backend/shared contracts and production API dependencies. Frontend sources and Next.js are excluded; TypeScript remains in the resolved graph as an optional peer of the OpenAPI package. The Socket.IO client is retained for the operational integration checks. Read-only, non-root execution is enforced independently.

## Verification and recovery

Run `scripts/test-backend.ps1` to build and test real PostgreSQL/Redis/S3/scientific services in a unique test schema, queue prefix and bucket. `-LiveSources` adds real Europe PMC/RCSB search and cached structure downloads. Tests exercise auth/replay, authorization, idempotency, quotas, concurrent XP, room conflicts/socket revocation, queued cancellation, batches/investigations, SSE, artifacts, offline signatures, challenges, scientific reference cases and the subprocess supervisor. The namespace is explicitly checked before cleanup. Tests do not delete the development database or bucket.

`node apps/api/dist/cli.js cleanup` runs retention manually; jobs also runs it periodically. Raw run output, artifact, cached structure and companion-response retention defaults to 90 days. Historical runs retain inputs/status/provenance and expose `result_available=false` after output expiry; old results cannot be reused as new assessment evidence. Cited source metadata is preserved, while uncited expired cache records are purged. Orphan run objects older than an hour are swept in bounded pages. Preserve results required for long-term reproducibility in an external archive before retention expires.

Use `scripts/backup-database.ps1` and `scripts/restore-database.ps1 -Archive <dump> -DatabaseName senku_restore_<new-id>`. Restore verifies the checksum and creates a fresh database; it never overwrites the active database. For artifacts, mount a fresh private directory at `/backups` and run `node scripts/backup-artifacts.cjs backup /backups` inside the API image. The manifest preserves keys, metadata, byte lengths and content hashes. To verify restoration, mount that directory read-only, set a new `RESTORE_BUCKET=senku-restore-<id>`, and run the same script with `restore`. It refuses an existing bucket and verifies restored bytes. Backup output belongs in ignored `backups/`, encrypted off-host with restricted access.

For a coordinated recovery set, stop external admissions and let active jobs finish, then stop jobs/maintenance before taking the database and artifact snapshots. Keep both snapshots together, record image/configuration identities, and restart jobs after verifying them. Redis is a recoverable transport; PostgreSQL/outbox preserve pending work. Restore into isolated resources first and exercise authenticated artifact access before changing production endpoints. Retain and test off-host copies on the operator's recovery schedule.
