# Integration contracts

Source: masterplan sections 9-13, 22-27. The requirements below preserve the source interpretation. Canonical executable contracts now live in packages/experiment-schema, apps/api/src/database/migrations and generated /openapi.json. See backend.md for implemented route differences, authentication, cancellation, replay and limits.

## Experiment identity

Separate experiment definition, scientific model version, engine/adapter version, renderer, learning rubric, and run identity. An experiment manifest binds approved parameters and outputs to learning objectives and one supported execution path. Learn and Lab consume the same binding. Persist actual versions on runs so future content updates cannot rewrite historical results.

Manifest requirements: ID/version/domain; supported modes; model ID/status/assumptions; runtime/adapter compatibility; image digest for remote work; parameter types/units/bounds/defaults; declared outputs/artifacts; renderer capabilities; learning goals/completion rules; provenance/reviews/limitations; safety class; resource budget; seed support.

Sections 10 and 24 have different example layouts and enum names. They are source examples, not two independent supported schemas. Resolve a canonical schema before implementation. Browser runtimes do not have worker image digests; represent that explicitly rather than fabricating one.

## Adapter lifecycle

`validate(input)` -> `prepare(input)` -> `execute(context)` -> `normalize(output)` plus `diagnostics(output)`.

Validate allowed model, types, units, bounds, format, quota, capability and budget before scheduling. Prepared input is data, not uploaded executable code. Record diagnostics even on failure. Cancellation, timeout, retries, and partial artifacts need a common lifecycle before adapters proliferate.

## Canonical run result

Record run ID; experiment/model versions; engine ID/version and adapter version; applicable image digest; validated parameter values with units; optional seed; timestamps; status; scientific status; diagnostics/warnings; references; output/artifact manifests and hashes. Add provenance rather than replace raw solver outcomes with narrative text.

Artifact families: scalar, time series, matrix, spatial frame, molecule, network, document, table. UI capability names such as structure, chemical_graph, reaction_network, spatial_cells, and heatmap need a documented mapping to those families. Renderer selection follows validated metadata, never arbitrary LLM-generated component code.

## API inventory from the plan

| Method | Route | Purpose |
|---|---|---|
| GET | /v1/subjects | Worlds/subjects |
| GET | /v1/lessons/:id | Lesson definition |
| POST | /v1/lessons/:id/attempts | Learning progress |
| GET | /v1/experiments | Catalog |
| GET | /v1/experiments/:id/versions/:version | Versioned manifest |
| POST | /v1/runs | Validated execution request |
| GET | /v1/runs/:id | State and outputs |
| GET | /v1/runs/:id/artifacts | Artifacts |
| GET | /v1/runs/:id/diagnostics | Solver/runtime diagnostics |
| GET | /v1/runs/:id/reproducibility | Reproducibility bundle |
| POST | /v1/investigations | Bounded workflow |
| GET | /v1/investigations/:id/events | SSE stream |
| POST | /v1/challenges/:id/attempts | Challenge scoring |
| POST | /v1/sync/events | Idempotent offline reconciliation |
| GET | /v1/classrooms/:id/progress | Authorized teacher progress |
| GET | /v1/engines | Engine capabilities |
| GET | /v1/models | Reviewed model catalog |
| GET | /v1/models/:id/versions | Model versions |
| POST | /v1/pathways/validate | Typed graph validation |
| POST | /v1/pathways/compile | Approved graph to model |
| POST | /v1/simulation-batches | Bounded sweep |
| GET | /v1/simulation-batches/:id | Batch status/results |
| POST | /v1/structures/search | Source discovery |
| GET | /v1/structures/:id | Structure and provenance |
| POST | /v1/molecules/validate | Sanitization/validation |
| POST | /v1/molecules/describe | Scoped descriptors |

Authentication, authorization, ownership, body limits, quota and error schemas are required across relevant endpoints. This route list does not specify a cancellation endpoint, artifact authorization URLs, auth flows, pagination, share links, or SSE replay. Those remain API design work.

## Events

Plan event names: agent.started, agent.completed, run.queued, run.progress, run.completed, run.failed, investigation.completed. Every event carries workflow ID, unique event ID, timestamp, and typed payload. Failure/cancellation events for agents and investigations, ordering, reconnect cursors, and retention remain to be specified. Do not infer a successful completion from a disconnected stream.

## Entity inventory

Learning/accounts: users, subjects, lessons, lesson_prerequisites, lesson_attempts, concept_mastery, achievements, user_achievements.

Experiments/runs: experiment_definitions, experiment_runs, run_artifacts, scientific_models, model_versions, engine_adapters, engine_capabilities, run_diagnostics, artifact_manifests, model_validation_reviews, experiment_publications.

Investigations/evidence: investigations, agent_tasks, citations, source_records, simulation_batches, simulation_batch_members.

Domain assets: structure_assets, pathway_documents. Classroom/challenges: challenges, challenge_attempts, classrooms, classroom_members, assignments. Offline: offline_events.

Source ER diagrams are conceptual. Model reuse cardinality, run_artifacts versus artifact_manifests, publication lifecycle, ownership, and retention need explicit schema design before migrations.
