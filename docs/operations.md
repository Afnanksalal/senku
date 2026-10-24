# Operations and deployment

Source: masterplan sections 7-9, 15-16, 24-27. Status: target deployment model, not deployed infrastructure.

Target: Docker Compose on a VPS behind TLS via Caddy or Nginx. Services: Next.js web, NestJS API, PostgreSQL, Redis/BullMQ, MinIO/S3-compatible artifacts, queue workers, sandbox supervisor, separate scientific images, restricted connectors, metrics/logging. Keep private services on internal networks.

Secrets are environment-managed and never committed or included in learner-facing exports. Define per-user quotas, concurrency budgets, health checks, retention and backup/restore before public use. Host CPU/RAM/storage determine heavy-job concurrency; no capacity guarantee exists yet.

Scientific images use pinned digests and tested native dependency combinations. Keep engine capability/version inventory separate from a list of desired libraries. Supervisor handles non-root isolated execution, workspace lifecycle, bounded resources, cancellation and audit. Workers have no host Docker socket; default-deny egress is separate from research connectors.

Operational observability should connect request, investigation, task, batch and run IDs to status, duration, warnings and artifacts without exposing secrets or unnecessary learner data. Metrics retention, logging provider and incident process remain undecided.

Before deployment verify image/decoder paths, artifact access controls and hashes, cache behavior, service health, timeout/retry/cancellation behavior, permissions, actual egress/isolation, backup restore and bounded concurrency. A generated Compose file alone is not this evidence.

## Implemented backend operations

The backend implementation, production configuration gates, actual lifecycle, migration/admin/cleanup CLI, recovery scripts, test isolation and provider limitations are maintained in [backend.md](backend.md). Earlier paragraphs describe the target infrastructure, not evidence of a public deployment.
