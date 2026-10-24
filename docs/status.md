# Implementation status

As of 2026-10-24. See [environment-verification.json](environment-verification.json) for service/image identity and checks.

| Area | Status | Evidence / limitation |
|---|---|---|
| Repository/knowledge | Initialized and documented | Original 31-section masterplan unchanged; decisions and launch brief retained |
| Docker | Installed and running | Docker Desktop 4.96.3, WSL2, Engine 29.9.2, Compose 5.6.1 |
| Web/API | Bootstrap only | Next.js and NestJS builds and health routes pass; no learner features |
| Dependencies | Installed in Docker and locked | Main and separate React 18 editor graphs audit clean; npm dependency trees have no problems |
| Data infrastructure | Running locally | PostgreSQL query, Redis/BullMQ job and MinIO S3 object round-trips pass |
| Science environments | Eight running and healthy | Numerics, RDKit, COBRApy, RoadRunner, Tellurium, COPASI, BioSimulators utilities, PhysiCell |
| Scientific checks | Dependency/toy solver smoke passed | SciPy decay, RDKit conformer, toy COBRA objective, RoadRunner/Tellurium decay, COPASI native model object, SED-ML utilities and PhysiCell dynamic linking |
| Scientific adapters | Not implemented | Health endpoints explicitly report execution_available=false; no reviewed Senku model/lesson |
| Molecule editor | Isolated dependency environment | React 18/Ketcher installed separately; editor_available=false pending UI/protocol integration |
| Rendering libraries | Installed | Three/R3F/Drei, GSAP, postprocessing, Rapier, ECharts, Mol*, React Flow; no scientific scenes built |
| Collaboration/auth/learning | Libraries installed, behavior unimplemented | No rooms, auth policies, saved progress, classroom or sharing workflows |
| AI/GCP | SDK installed, access unconfigured | No project/credentials configured, models called, resources provisioned or credits spent |
| Offline | Helpers installed, behavior unimplemented | No service worker, cache packs, local solver integration or sync protocol |
| Worker isolation | Development restrictions configured | Internal network, non-root, read-only, resource caps, dropped capabilities; external route blocked in one representative worker. Not a completed per-job sandbox supervisor |
| REA / agent skills | Prior setup retained | Development tooling, not product simulation infrastructure |
| Production readiness | Not established | No public deployment, full model validation, privacy/role policies, production backup/restore or representative-device UI acceptance |

Fourteen long-running development services are healthy. This is a verified dependency/bootstrap environment, not the full platform. BioSimulators utilities are not themselves a simulator adapter. PhysiCell builds the upstream template; no Senku-specific tissue scenario is implemented or scientifically validated. Its native build must be checked on deployment hardware before claiming portability.

The requested full-platform scope remains in launch-brief.md. Teacher tools and public community follow the learner launch. No application features are marked complete merely because a dependency is installed.
