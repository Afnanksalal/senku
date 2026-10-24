# Contributing to Senku

Thank you for helping make science easier to explore. Focused fixes, clear bug reports, accessible interfaces, reproducible scientific examples and accurate documentation are useful contributions.

## Before starting

Read [AGENTS.md](AGENTS.md), the [launch brief](docs/launch-brief.md) and [current status](docs/status.md). The knowledge base distinguishes shipped behavior, plans and validation limits. For a substantial feature or a scientific contract change, open an issue describing the learner problem, proposed scope and how it will be checked before investing in a large implementation.

Use the Docker environment in [README.md](README.md). Commit lockfiles with dependency changes. Do not mix unrelated reformatting or dependency updates into a feature patch.

## Working agreements

- Keep numerical results tied to actual model inputs and saved runs. Never fill an empty state with invented results, citations, logs or progress.
- Scientific changes need explicit rules, units, input bounds, assumptions, limitations, reference cases and tolerances. Preserve model/version continuity. Implementation tests do not establish biological validity.
- Keep models and tools allowlisted. Do not add arbitrary code execution, unrestricted target uploads, privileged workers or runtime fetches from caller-controlled URLs.
- Use Senku's existing mascot, palette, type and component language. Follow the [design guide](docs/frontend/DESIGN.md) and [frontend contract](docs/frontend/FRONTEND_CONTRACT.md). Check keyboard access, narrow screens, enlarged text, loading, failure and offline states.
- Keep product copy in Senku's voice. Avoid provider branding, implementation jargon, Lucide icons, gradients and em dashes in learner-facing copy.
- Preserve `docs/source/Senku_Detailed_Plan.md` byte for byte. Update derived documents when an accepted decision changes.

## Verify the patch

Run checks appropriate to what changed. Typical commands from the repository root are:

```powershell
./scripts/verify.ps1
./scripts/test-backend.ps1
./scripts/verify-science.ps1
./scripts/verify-docking.ps1
```

```sh
docker compose --profile tools run --rm --no-deps tooling npm run typecheck
git diff --check
```

For frontend changes, build the web image and exercise the actual interaction at desktop and mobile sizes:

```sh
docker compose build web
```

If the change needs external sources or the configured explanation service, report those checks separately from offline/substituted-provider tests. Do not claim a check ran when it was skipped. The backend test harness uses disposable namespaces; never point cleanup code at development or production data.

## Pull requests

Explain the concrete problem, resulting behavior and validation. Include before/after screenshots for visual changes. State relevant limitations and describe any migration, configuration or dependency change. Tests should cover meaningful behavior and failure boundaries rather than repeat the implementation.

Update the owning documentation and [status](docs/status.md) when behavior becomes real. Keep generated build output, dependency directories, private learner exports and temporary screenshots out of Git unless they are intentional reviewed documentation assets.

## Secrets and licensing

Commit only example configuration. Never include `.env`, `.secrets`, credentials, tokens, private keys or personal data in a patch or issue. Follow [SECURITY.md](SECURITY.md) for sensitive reports.

Contributions to original Senku code are under the repository's MIT license. Preserve third-party notices and the applicable terms for libraries, structures and assets. Do not assume the root license relicenses a dependency or dataset.
