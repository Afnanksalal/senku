# Security policy

## Reporting a vulnerability

Do not disclose credentials, learner data or an exploitable vulnerability in a public issue or pull request. Use [GitHub's private vulnerability reporting](https://github.com/Afnanksalal/senku/security/advisories/new), enabled for this repository. No separate monitored security email or guaranteed response time is advertised.

A useful report includes the affected commit/version, reproduction steps, impact, relevant configuration and a minimal example with secrets and personal data removed. Please give the maintainer an opportunity to investigate before public disclosure.

## Supported scope

Senku is under active development. Security fixes target the current default branch; there is no supported stable release series or published response-time commitment yet. The included Compose setup is intended for local development, with host interfaces bound to localhost. A passing CI run does not certify an Internet-facing deployment.

Local authentication, role/ownership checks, compute admission, quotas and isolated workers are implemented and tested. Public deployment still requires operator-managed TLS, least-privilege identities, database/object-storage access controls, backup retention, monitoring and workload verification. Follow [backend operations](docs/backend.md) and [runtime configuration](docs/configuration.md).

## Credential handling

- Keep secrets out of Git, Docker build arguments, browser code, `NEXT_PUBLIC_*` variables, screenshots and logs.
- Use ignored local configuration and read-only runtime mounts, or workload identity in a deployment. Never copy a credential file into an image.
- Treat invitation and share codes as secrets. Do not paste session tokens or cloud authorization codes into issues or chat.
- Rotate exposed credentials immediately. Removing a file in a later commit does not remove it from Git history.
- Keep personal exports and database/object-storage backups private and protected according to their retention policy.

## Execution and retrieval boundaries

Scientific workers must retain their non-root, read-only, bounded-resource execution and private-network boundaries. They must not receive a host Docker socket, caller-supplied code, unrestricted networking or arbitrary execution images. Docking accepts only its curated proteins and fixed binding sites.

Retrieved papers, public structures, model text and tool output are untrusted data. They cannot authorize tool execution or change system instructions. See [execution policy](docs/ai-and-safety.md) and [docking limits](docs/docking.md).
