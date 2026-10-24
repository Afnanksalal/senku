# Implementation status

As of 2026-10-24. Original dependency bootstrap evidence remains in [environment-verification.json](environment-verification.json). Backend behavior, contracts and operating limits are documented in [backend.md](backend.md) and [backend coverage](backend-coverage.md).

| Area | Status | Evidence / limitation |
|---|---|---|
| Repository/knowledge | Initialized and maintained | Archived masterplan unchanged; backend decisions and coverage recorded |
| Backend | Implemented locally | NestJS identity/RBAC, learning, offline reconciliation, scientific runs, sources, investigations, rooms/sharing, classroom foundations and operations |
| Data infrastructure | Running locally | PostgreSQL migrations/transactions, durable outbox, Redis/BullMQ transport, private S3 artifacts |
| Scientific adapters | Seven implemented | Numerics, RDKit, COBRApy, RoadRunner, Tellurium, COPASI, PhysiCell |
| Scientific tests | Native reference cases | Enzyme conservation, logistic solution, inheritance, diffusion conservation, three-engine decay agreement, descriptors, flux balance and generic cells |
| Scientific validity | Educational fixtures | No model is claimed to be empirically validated; BioSimulators utilities are not an execution engine |
| Learning/offline | Connected and browser-tested | Four games with recomputed device evidence and exact-once rewards; signed lesson preparation, disconnected reload/completion, account-bound queue and accepted server receipts |
| Collaboration/sharing | Connected and live-tested | Shared-room UI, optimistic revisions, memberships, share/revoke and actual same-origin websocket parameter events through nginx |
| Classrooms | Connected and role-tested | Learner joins/assignments; teacher/admin class creation, assignment, progress/CSV, code rotation and archive tested in API and browser |
| AI/GCP | Connected locally and live-tested | ADC-mounted Gemini 4 Argon chat and scoped AI investigation completed through planner, real jobs, retrieved citations and Gemini report |
| Sources | Fixed-host connectors implemented | Europe PMC metadata, RCSB search/metadata and bounded cached structure files |
| Worker isolation | Per-job supervision implemented | Non-root/read-only internal-network containers, bounded child process groups, actual cancellation/timeouts and output limits |
| Operations | Local tools implemented | Metrics/readiness, cleanup/retention, database/object snapshot restore and CI definition |
| Frontend | Expanded local platform implemented | Explore/Learn/Lab/Play/Research/Companion/Pathways/Shared labs/Classroom/Offline surfaces connected; 34 routes passed 102 responsive width checks. Scientific 3D/2D scenes and real molecular/structure viewers, frame controls, exports and provenance |
| Production deployment | Not certified or published | Requires real TLS/identity/secrets, least-privilege deployment roles, billing/alerts, load/SLO/privacy checks and off-host recovery exercises |

The backend is no longer a health-only scaffold. Feature implementation, local integration evidence, live provider verification and scientific validity remain separate statuses. The operating guide makes the remaining deployment-dependent gates explicit.

Latest delivery direction: local auth only, working frontend/backend integration first. Firebase was removed from runtime and dependencies. Eight functional API/service suites passed on the final local-auth image; the seven native reference suites and process supervisor were verified earlier without scientific adapter changes afterward. API and jobs are left running locally. Live Gemini credentials remain the only provider setup required for AI calls. Cursor acknowledged the integration contract in docs/INTEGRATION.md.

## Google provider connected locally
Google project project-f262e754-ce96-4f0c-b24 is configured for gemini-4-argon at global. User ADC is stored only under ignored .secrets/gcloud and mounted read-only into API/jobs using compose.gemini.yaml. Gemini is enabled locally. A minimal structured request and the actual GeminiService JSON/Zod boundary both passed against the live provider; /ready reports all dependencies OK. Broader AI lesson and investigation quality has not been evaluated by these connectivity checks.


## Frontend integration verification
Web is now built and running with same-origin /backend forwarding to the API container. All catalog/lesson manifests load. Browser checks passed for local account registration/login/logout/refresh, device experiments and full lesson XP scoring, admitted server runs and result retrieval, bundle download, and 390px width. Mol* renderer initialization was fixed using the package's CommonJS distribution; a real RDKit conformer rendered in Edge. General 3D experiment scenes, cell-colony frame rendering, and the previously recorded absent feature UI remain unfinished. Temporary browser test account removed via the account API; Afnan has user-requested active lab membership.

## Expanded platform pass

Latest user instruction explicitly moved all frontend ownership to Codex and authorized parallel agents. Three parallel workstreams implemented research/offline, companion/collaboration/classrooms and games/scientific scenes, while the root integrated navigation, learning progress, pathways, backend scoring and deployment.

Verified locally:
- Four local games: authoritative 30 XP per first success, 120 XP total across four scoped test challenges, idempotent replay, invalid/spoofed evidence rejection and guest denial. Browser game run/submit passed.
- Gemini chat returned a real model-grounded explanation. Scoped AI research completed all six tasks, two real oxygen-comparison runs (energy outputs of 40 and 80), five Europe PMC references and a Gemini report with valid citation IDs. Planner context is restricted to a selected approved experiment. Optional report failure preserves real facts in an explicitly labeled deterministic report.
- Pathway UI compiled S1 to S2 and executed RoadRunner; concentrations after 30 minutes were approximately 0.4979 and 9.502 mM. Saved documents and SBML are real backend records.
- Three.js cell positions/volume radii, diffusion height grid and clearly labeled ecosystem schematic rendered from retained run data; 2D controls worked. Existing RDKit/Mol* molecule renderer remains connected. CSV/JSON exports carry real run provenance.
- Prepared lesson reloaded with the browser network disabled; two device runs and reflection queued without cloud XP. Reconnection accepted the signed evidence and returned a server receipt.
- Same-origin authenticated Socket.IO room event passed through nginx; teacher/classroom API 43 checks and two-browser role/join/assignment flows passed.
- Expanded UI sweep:34 routes at 375, 1024 and 1440 pixels, 102 checks, no horizontal page overflow and one primary heading per page. These are browser checks, not full WCAG certification or hardware performance validation.

Local public entry is nginx on port3000; Next is internal. API and jobs retain the read-only ADC mount. The ignored local environment uses 600 general requests per minute to accommodate interactive polling and broad local testing; the committed default remains 120 and auth/compute admission limits are unchanged.

Still incomplete: public community/remixing/leaderboards, broad authored curriculum/prerequisite and spaced-repetition content, arbitrary model import/general editors, empirically validated biological models and external production deployment. Full product ambition remains tracked; this pass is not a claim that every masterplan section is finished.
