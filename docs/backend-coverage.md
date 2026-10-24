# Backend implementation coverage

Implementation pass requested on 2026-10-24. The owning guide is [backend.md](backend.md); generated OpenAPI is served at `/openapi.json`. The frontend is a separate workstream. Scientific implementation tests and empirical validation are distinct.

| Area | Implemented behavior | Verification |
|---|---|---|
| Foundation | Validated config, body/output caps, correlation IDs, safe errors/logs, exact CORS, Redis rate limits, OpenAPI, liveness/readiness, shutdown | Docker build and HTTP integration |
| Data | Checksummed migrations, constraints/indexes, immutable catalog, transactions, audit/events/outbox | Fresh isolated schemas; real PostgreSQL |
| Identity | Guests, local scrypt identity, rotating sessions, role checks, account export/deletion | Local flows and replay/socket revocation tested; no external identity provider |
| Admission | Hashed expiring invitations, atomic global/group/member UTC daily budgets | Concurrent one-unit race and cancellation release tested |
| Catalog | Ten approved educational manifests, model/lesson versions, parameter bounds/units, capabilities | API integration; reviewed code-owned seed |
| Learning | Server scoring, mastery, achievements, exactly-once XP, progress/streaks, run-based challenges | Concurrent reward and retry/conflict checks |
| Offline | Signed 30-day packs, at most 50 atomic events, server-recomputed local kernels | Signature tampering, duplicate/conflicting IDs and credit tested; browser storage remains frontend work |
| Runs | Idempotent admission, durable dispatch/reconciliation, lifecycle, bounded retry, cancel/deadline, diagnostics/replay | Real queued API-to-engine-to-S3 path; queued cancellation and supervisor checks |
| Science | Numerics, RoadRunner, Tellurium, COPASI, RDKit, COBRApy and generic PhysiCell adapters | Seven native reference suites; educational fixtures only |
| Artifacts | Owner/room authorization, hashes, bounded private S3 downloads, retention/orphan cleanup | Cross-user denial, content/hash round trips, snapshot restore |
| Batches | Atomic sweeps of at most eight runs, aggregate states/cancellation | Integration and queued cancellation |
| Sources | Fixed-host Europe PMC/RCSB queries, bounded retrieval/cache, hashed CIF downloads | Live source suite is optional and explicitly reported |
| Investigations | Persisted task DAG, real sweeps, exact facts, critique, citations, deterministic reports; optional Gemini | Deterministic pipeline/SSE tested; live Gemini needs credentials |
| Companion | Explicit invocation, allowlisted context/parameter suggestions, structured AI output and allowance | Disabled-provider response tested; live Gemini needs credentials |
| Sharing | Expiring hashed read/editor links, revocation and safe public projections | Membership and revoked link checks |
| Collaboration | Authenticated sockets, roles, optimistic versions, durable replay, database-backed cross-instance polling | Real socket edit, origin rejection and session disconnect tests; large-scale load not certified |
| Classrooms | Teacher/admin creation, code rotation, membership, assignments, class-scoped progress | Learner/teacher authorization integration; teacher UI deferred |
| Operations | Separate jobs process, retention/privacy cleanup, admin metrics, production config/migration guards, database/object backup/restore, CI workflow | Local restore exercised; GitHub runner/public deployment not yet executed |

## Scientific and delivery limits

All initial models are `illustrative_educational`. Reference checks establish implementation behavior, not biological or clinical validity. Native output records engine version and adapter source hash. Local image_digest is null unless the operator supplies the actual deployed digest. Preserve immutable deployment images and source artifacts for replay.

Vertex identity, Gemini responses/billing, public TLS, production workload limits, provider-specific backup policies and representative deployment hardware still need the real environment. No GCP resources were provisioned and no credentials were embedded. No public community or teacher-facing UI is included in this backend pass.

## Expanded browser integration evidence
The current local browser pass connects source search, structure preview, scoped AI investigations, real Gemini chat, four game rewards, reaction-network compilation/runs, shared Socket.IO rooms, classroom roles and offline reconciliation. All 34 current catalog, lesson, game and index routes passed checks at 375, 1024 and 1440 pixels. Live research completed all six stages with energy outputs of 40 and 80, five Europe PMC references and a Gemini report. These local results supersede earlier live-provider-unconfigured notes; public production deployment and empirical scientific validation remain separate.
