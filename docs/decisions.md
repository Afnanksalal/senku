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
