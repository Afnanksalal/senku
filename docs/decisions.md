# Decision register

Last updated: 2026-10-24. Confirmed = explicit product intent or user requirement. Proposed = reasoned recommendation, not approved implementation. Open = resolve before dependent work. No external technical or legal validation is implied.

| ID | Status | Decision / issue | Basis and next action |
|---|---|---|---|
| D01 | Confirmed | One integrated scientific core; BioForge is not separate | Sections 20/31; shared manifests/model versions/solver/results across modes |
| D02 | Confirmed | Biology first, extensible domains | Sections 1/19/31 |
| D03 | Confirmed | No Lucide, gradients, em dashes; original premium glass/playful identity | Explicit user chat; supersedes style defaults |
| D04 | Confirmed | Real 3D where useful, with equivalent 2D/low-power science access | Reconcile chat emphasis with sections 4/25/28 |
| D05 | Confirmed | Full learner platform; school and college learners; today (2026-10-24) requested target | See launch-brief.md; scope confirmed, precise age band and credible completion date not established |
| D06 | Confirmed | Learners choose their first experiment; guided and free lab access immediately | Enzyme Explorer can remain an internal implementation slice, not a forced onboarding gate |
| D07 | Open | Canonical manifest and scientific-status enums | Section 10 uses runtime/domain/model_class; section 24 uses engine/subject/scientific_status. Write one versioned schema and migration policy |
| D08 | Open | Enzyme dimensional convention | Section 24 mixes substrate/Km concentration and Vmax amount/time. Clarify volume or rate-of-amount versus rate-of-concentration; do not copy example blindly |
| D09 | Confirmed | Build custom pathways from approved components | Composition/units/safety validation required; no arbitrary executable code |
| D10 | Open | UI foundation and alternatives | Plan: Tailwind/shadcn/custom; HeroUI was a research suggestion. Choose a single coherent primitive layer without forbidden icon defaults |
| D11 | Open | 2D renderer, charts and primary molecular viewer | Canvas/Pixi, ECharts/uPlot, Mol*/3Dmol remain alternatives. Evaluate actual workloads and accessibility |
| D12 | Open | Package manager/workspace, versions, ORM and auth | Stack is recommended, not installed. Verify compatible releases and licenses when selecting |
| D13 | Open | Native engine rollout and image digests | No engine/model is validated. Example digest and references are placeholders |
| D14 | Open | Run lifecycle, cancellation API and event completion semantics | Plan requires cancellation but does not specify its route or complete state machine; define retries, partial output and SSE replay |
| D15 | Open | Offline conflict and version compatibility policy | Define idempotency scope, cache eviction, account transitions, upgrades and deferred submissions |
| D16 | Open | ER cardinality and artifact metadata ownership | Experiment-model reuse and run_artifacts/artifact_manifests overlap need normalized schema |
| D17 | Partly confirmed | Gemini ecosystem, shared invitation-only cloud budget | Exact models, orchestration, spend caps and service eligibility remain open |
| D18 | Partly confirmed | Guest exploration, account for cloud saves; private work/share links; classroom later | Detailed age/privacy/retention policies and collaboration roles remain open |
| D19 | Open | Brand/naming and artwork rights | Plan requests original artwork and naming review before commercial launch; not performed |
| D20 | Partly confirmed | Existing GCP credits available; budget details tracked privately | Balance, exact expiry, eligible services, capacity, quotas and backups still need verification |
| D21 | Confirmed | REA is development tooling, not scientific execution infrastructure | User requested installation; shipped-artifact investigations only where relevant |

Resolve routine implementation details with evidence within authorized scope. Ask for product choices only when missing information materially affects the work. Record rationale and affected contracts when closing a decision; never silently turn proposals into requirements.

## Additional confirmed choices

- Concept-first content, English initially, learner-selected entry experiment.
- AI companion is quiet unless summoned.
- Real-time collaborative labs are required at launch, not deferred expansion.
- Teacher Studio/classrooms and public community/remixes follow the learner launch.
- Private work/share links precede public publication.
- Scientific libraries/public structures/custom geometry avoid a paid 3D-generation dependency.
- Full answers and implications: [launch brief](launch-brief.md).

## Dependency bootstrap selections (2026-10-24)

Authorized Docker-first setup selects npm workspaces, Node 24, TypeScript 5.9, Next/React, NestJS, Radix/custom UI, ECharts, Mol*, Drizzle/PostgreSQL, and Yjs/Socket.IO. These settle bootstrap tooling choices within D10-D12; auth policies, collaborative protocol, model schema and full scientific adapters remain open. See dependency-selection.md and setup.md. Docker Desktop is installed per-user using WSL2. No GCP project or credentials have been configured.

## Backend implementation decisions (2026-10-24)

- PostgreSQL is the source of truth. BullMQ transports work through a transactional outbox, stable job IDs and database-driven recovery. API and jobs run separately.
- One canonical executable experiment schema binds immutable model/experiment versions, bounded parameters, units and educational status. Catalogs/lessons are code-owned; arbitrary uploaded model/code/image execution is excluded.
- Guests explore catalogs and obtain offline packs. Durable cloud progress, collaboration and expensive work require an account; remote computation also requires a redeemed invitation.
- Development uses scrypt/opaque rotating sessions. Production uses Firebase verified-email identities with revocation checks; email alone cannot link accounts. Production startup forbids local registration and automatic migrations/bucket creation.
- Daily compute units are bounded operations, not a currency balance. Started attempts consume their unit. UTC server-day accounting and transactional global/group/member checks serialize admission correctly.
- Offline rewards are server-scored and exactly-once per lesson/version; event IDs reject conflicting retries. Streaks use server acceptance dates. The client cannot award XP or claim a server result.
- Rooms use owner/editor/viewer roles, expected-version edits and exact shared-run snapshots. Multi-instance updates read a shared durable PostgreSQL event log. Revoked links stop future link use; removing an existing participant is a separate owner action.
- Investigations use an actual persisted task DAG with deterministic reports by default. Optional Gemini prose never replaces authoritative solver facts, and citation IDs must match retrieved records. The companion stays quiet until explicitly invoked.
- Classroom API foundations are included in the backend pass; teacher UI and public community remain deferred as confirmed by the user.
- Worker outputs are bounded, hashed and retained privately. Cleanup defaults to 90 days; account deletion revokes access immediately and erases personal work after active computations stop. Operator backup expiry governs existing archives.
- Local engine versions and adapter source hashes are recorded. Image digests remain null unless actual deployment identity is supplied. Initial science fixtures are educational, without empirical validation claims.

See [backend.md](backend.md) for the operative API/protocol, deployment gates and verification commands. These choices settle the corresponding open implementation details in the earlier bootstrap notes; age/consent obligations and actual deployment capacity still require operator context.

## Latest user override: local auth and functional delivery

The user explicitly rejected Firebase and requested local/simple authentication, faster backend delivery and full coordination with Cursor's parallel frontend. This supersedes the earlier engineering selection of Firebase production identity. Firebase code/dependencies and the exchange route are removed; a new migration drops the unused binding. Local guest/email/password/session contracts stay unchanged. Further deployment hardening is not a completion gate for this pass. The live shared client contract and coordination log are docs/INTEGRATION.md.

## Local Gemini authentication
Use Google ADC for the selected project because its organization disallows API keys. Keep Senku account authentication local. No organization policy change or service-account key is needed. The pinned Docker CLI handles user consent; only the ADC JSON is mounted into API/jobs via the optional Compose file.


## Expanded learner platform decisions
The user superseded Cursor ownership and authorized parallel implementation of the remaining platform. Deliver current backend-backed learner/research/collaboration/classroom surfaces before further production hardening. Device challenge rewards are recomputed server-side from approved kernels. AI planning is scoped to an explicitly selected approved experiment to keep constrained generation bounded. Optional narrative failures must not discard completed solver evidence and must be labeled as AI unavailable. A dedicated nginx gateway handles same-origin HTTP and websocket traffic; credentials remain read-only ADC mounts for API/jobs only.

## Preserve-identity UI decisions, 2026-10-25
The user explicitly requires all tools, current colors, original mascot and artwork to stay. Improve mobile hierarchy and controls within that identity. Preserve `/` as the catalog; add `/welcome` and `/home`. Track earned learning XP rather than invent a spendable points wallet. Daily goals are owner-scoped preferences; activity and streak days explicitly use UTC.

## Natural learning and generated puzzles, 2026-10-25
The user wants less technical friction and dynamic AI-assisted learning. Shared controls default to plain-language labels and qualitative ranges; exact parameter keys, values and units remain in Precise mode. Results show friendly names/meanings with exact quantities available in details. These are presentation changes, not new solver math.

Four approved game worlds now support owner-bound generated scenarios. The server constructs randomized non-winning starts and reachable targets, with a private kernel-checked witness. Gemini selects among six verified candidates and adapts story, labels and hints to interests, difficulty and saved practice. Only approved controls are editable; fixed conditions and sample seed are enforced during scoring. Gemini never supplies executable UI or scientific results. The first success per base game retains its existing XP reward key, preventing regeneration from farming points.

Generation and post-test explanations use real compute admission and persistent idempotency. Provider interruption/unavailability retains explicitly labeled model-generated fallback content. Explanation evidence comes from retained owner runs or server-recomputed local inputs, never browser-asserted scalars. Scientific limits and exports remain available. Static device practice still works for guests and offline.

## Bounded teaching docking
User approved an isolated docking experiment with curated nonpathogen/nontoxin proteins, fixed known binding sites, size-limited ligands and reproducible controls. It reuses the existing run/quota/provenance stack. A dedicated Molecular Match surface handles pose/reference comparison; the generic Learn route does not invent a docking lesson. Numeric outputs remain solver-produced; Senku interprets compact saved facts. See docking.md for method, limits and verification boundaries.

## Molecular collections and comparison

The `/molecules` workspace adds real drawing/import/export, validated owner-private compound collections and bounded independent docking matrices. It reuses the existing scientific run lifecycle and approved binding sites rather than executing generated workflows. Collections and historical search snapshots have separate lifecycles. A Redis-backed docking-slot lease keeps queued batch members unconsumed and cancellable until computation can start; it does not serialize unrelated engines. One screen-level interpretation uses actual retained facts and a separate displayed unit. See molecular-workspace.md for supported chemistry, costs and evidence boundaries.
