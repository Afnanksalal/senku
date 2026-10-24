# Implementation and verification coverage

The owning API guide is [backend.md](backend.md). Generated documentation is available at `/docs`, with the machine-readable specification at `/openapi.json` on the API service. This table describes the current integrated local application; a future plan is not an implemented or validated feature.

| Area | Implemented behavior | Evidence and limits |
| --- | --- | --- |
| Foundation | Validated configuration, body/output caps, safe errors/logs, exact origins, rate limits, OpenAPI, health/readiness and shutdown | Container builds and HTTP integration; deployment load and SLOs require the actual environment |
| Data | Checksummed migrations, immutable catalog, constraints, transactions, audit events and durable outbox | Fresh isolated PostgreSQL schemas and concurrent transaction tests |
| Identity | Guest exploration, local scrypt accounts, rotating sessions, role checks, export and deletion | Local account, replay and socket-revocation checks; no external identity provider |
| Admission | Hashed expiring invitations and atomic group/member/global UTC allowances | Concurrent admission, exhaustion and cancellation-release tests |
| Catalog | Eleven approved educational manifests with versioned models, bounded parameters and capabilities | Code-owned immutable seed and API/schema checks; ten learning models plus the separate docking workspace |
| Personal learning | Generated situation/prediction/observation/reflection, validated suggested changes, private answer keys and versioned mission attempts | Isolated preparation/scoring tests plus live configured mission flows; no generated numerical result is used as a solver substitute |
| Games | Four game worlds with fresh saved scenarios, real numerical previews, verified attempts and once-only rewards | Dynamic generation, owner isolation, fixed-condition/seed checks and real browser scoring; replay avoids repeat reward credit |
| Progress | Server-authoritative XP, mastery, achievements, streaks, daily goals, history and usage | Concurrent/repeated reward checks and integrated profile/home views |
| Natural entry | Bounded question-to-destination routing and transfer of learner context | Allowlisted routes, ownership/admission/idempotency tests and a real question-to-personal-mission browser flow |
| Offline/PWA | Install manifest/icons, explicit update acceptance, prepared lessons, signed 30-day packs and idempotent reconciliation | Browser saved-lesson/offline checks and tamper/replay/conflict tests; installation does not save all content, and physical-device coverage is limited |
| Runs | Durable queue dispatch/reconciliation, lifecycle, bounded retry, cancellation/deadline, diagnostics and replay | Real API-to-worker-to-private-storage flow, queued cancellation and subprocess supervisor checks |
| Science | Numerics, RoadRunner, Tellurium, COPASI, RDKit, COBRApy, generic PhysiCell and Vina adapters | Native/reference checks; approved educational fixtures, not empirical biological validation |
| Docking | Two pinned teaching proteins, reproducible preparation, fixed boxes, sanitized ligands, ranked poses, crystal comparison and exports | Real reference redocking, deterministic replay, limits/cancellation, actual UI search and saved-result interpretation; see [docking evidence](docking.md) |
| Artifacts | Owner/room authorization, hash/byte integrity, private downloads and retention cleanup | Cross-user denial, object-store round trips, live coordinate/export identity and recovery checks |
| Batches | Atomic bounded sweeps with aggregate states and cancellation | Integration checks; a batch is a collection of actual runs |
| Sources | Fixed-host paper/structure search, bounded retrieval/cache and hashed structure downloads | External-source checks are opt-in and reported separately; metadata alone does not prove a paper supports a claim |
| Investigations | Persisted task stages, bounded approved runs, extracted facts, critique, citations and report | Deterministic pipeline/SSE plus configured local research flows; live provider access is not required or assumed in ordinary CI |
| Companion | Context-grounded responses, bounded suggestions, persisted request status and allowance | Isolated substituted-provider tests and configured live conversations/reflections; interpretation remains educational and reviewable |
| Sharing/collaboration | Private links, roles, optimistic revisions, shared runs, authenticated sockets and durable replay | Role/ownership, revocation, reconnect/edit and origin checks; large-scale load is not certified |
| Classrooms | Role-scoped classes, membership, assignments, progress and exports | API authorization checks and implemented classroom surfaces; a complete teacher workflow is not independently certified |
| SEO/previews | Public canonical metadata, raster social artwork, sitemap/robots and generic private-page previews | Initial HTML/crawler checks and image dimensions; public indexing and crawler reachability need a real HTTPS origin |
| Operations | Jobs, retention, privacy cleanup, metrics, migration/config guards, database/object backup and restore | Local integration/restore evidence and committed CI workflows; actual Actions status is visible in GitHub, not inferred from local success |

## How to read test evidence

- Infrastructure checks exercise service health and connectivity.
- Contract and isolated integration tests exercise validation, authorization, state changes and persistence. Tests that substitute an explanation or computation provider label that substitution explicitly.
- Native reference tests exercise actual scientific libraries and fixed known cases.
- Live browser checks exercise a configured local deployment and actual interactions, including some real connected requests.
- A CI check proves only the commands that ran in that workflow. It does not establish public deployment availability, live provider billing behavior or scientific validity.

See [status.md](status.md) for the recorded checks, [docking.md](docking.md) for docking preparation/reference details and [CONTRIBUTING.md](../CONTRIBUTING.md) for the contribution workflow. Test counts can change as checks evolve; do not treat a historical count as an acceptance certificate for a later commit.

## Scientific and delivery boundaries

All current models are labeled `illustrative_educational`. Native outputs preserve versions, seeds and adapter/source hashes. A local `image_digest` remains null unless the operator supplies the actual deployed digest. Preserve the image and assets needed for long-term replay.

Configured local provider requests have been exercised; another clone still needs its own project, permissions, model access and budget admission. No repository command automatically provisions those resources. Public TLS, deployment identities, representative load, monitoring, backup retention policy and physical-device/accessibility certification remain operator work.

The molecule-editor dependency environment is installed separately; it is not advertised as a completed integrated editor. Public community/remix discovery and a fully reviewed teacher platform remain outside the current learner-focused delivery. The archived masterplan is retained as source material rather than relabeled as completed work.
