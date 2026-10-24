# Architecture

Source: masterplan sections 7-13, 20, 23-28. Status: proposed architecture from the plan, not implemented. Pin and verify dependencies at implementation time.

## Shared scientific core

All product modes consume a versioned experiment registry. The core validates model eligibility, schema, units, and quotas; routes work to a suitable runtime; normalizes results; and preserves provenance. Renderers consume typed artifacts. Simulation code owns numerical state; animation presents it.

Browser path: PWA -> experiment manifest -> Web Worker / optional WASM -> canonical result -> visualization and progress.

Remote path: authenticated request -> validation and policy -> Redis/BullMQ -> sandbox supervisor -> approved scientific worker -> result validation -> PostgreSQL metadata + object-store artifacts -> SSE status -> UI.

Evidence path: permissioned read-only Europe PMC / RCSB connectors -> vetted/cacheable records -> source manifest -> investigation or structure viewer. Workers do not fetch arbitrary internet inputs.

## Planned technology choices

| Layer | Plan recommendation | Unresolved choice |
|---|---|---|
| Web/PWA | Next.js, TypeScript | Versions, workspace/package tooling |
| UI | Tailwind, shadcn/ui, custom system | Primitive foundation; HeroUI was a chat candidate, not a final replacement |
| 2D | Canvas 2D or PixiJS | Choose by workload |
| 3D | Three.js / React Three Fiber, Drei | Scene ownership, asset pipeline, quality tiers |
| Motion | GSAP, per chat direction | Task-specific motion ownership |
| Plots | ECharts or uPlot | Accessibility, size, series performance |
| Offline computation | Web Workers, optional Rust/WASM | JS first versus kernel requirements |
| API | NestJS | Auth provider and service boundaries |
| Science | Separate Python/native adapters | Versions, images, engine rollout |
| State | PostgreSQL, Redis/BullMQ, S3-compatible storage/MinIO | ORM, migration ownership, retention |
| Realtime | SSE for task updates; WebSockets for collaboration | Reconnect and replay protocols |
| Deployment | Docker Compose VPS, Caddy or Nginx | Host capacity, proxy, monitoring |

The user's requested 3D quality applies to scenes that benefit from 3D. It does not override the plan's mobile/offline 2D path or make WebGL a scientific dependency.

## Intended module ownership

| Future location | Responsibility |
|---|---|
| apps/web | PWA, lessons, laboratory, educator UI |
| apps/api | Auth/roles, curricula, registry, runs, investigations |
| packages/experiment-schema | Versioned manifests, parameters/units, canonical results |
| packages/science-ui | Plot, molecular, pathway, spatial renderers |
| packages/learning-engine | Quests, XP, mastery, assessment |
| packages/offline-runtime | Local computation, worker protocol, optional WASM |
| packages/agent-contracts | Task DAGs, scoped tools, typed events |
| services/sandbox-supervisor | Image allowlist, resource budgets, lifecycle |
| services/workers/* | Separate numerics, RoadRunner, COPASI, COBRApy, PhysiCell, RDKit, BioSimulators stacks |
| services/source-connectors | Read-only literature and structure retrieval |
| content/experiments, lessons, challenges | Reviewed definitions, assets, scoring and fixtures |
| infra/compose, monitoring | Private deployment, observability and recovery |
| tests/scientific, integration, security | Numerical, cross-mode, adapter and isolation evidence |

These are ownership boundaries, not empty folders that imply working features. Create code modules as their vertical slice is implemented.

## Boundaries to preserve

No renderer-specific science solver. No separate lesson-only fake model. No arbitrary generated UI or execution code from an LLM. Do not merge all scientific native dependencies into one worker environment. Do not give scientific workers a host Docker socket. Keep connector credentials and research network access separate from computation.

## Bootstrap implementation note

Docker-first workspace and service scaffolding now exist. Selected concrete dependencies are recorded in dependency-selection.md; actual checks belong in status.md. This does not imply completed application features, collaboration, adapters or isolation supervisor.
