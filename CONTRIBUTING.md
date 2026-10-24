# Contributing

Read AGENTS.md, docs/launch-brief.md and docs/status.md before changing scope or architecture. Use the Docker environment in README.md and commit lockfiles alongside dependency changes.

Keep changes focused. Scientific changes need equations/rules, units, parameter bounds, limitations, reference cases and tolerances. Every numerical UI result must trace to a real run. Label unimplemented features and mockups honestly.

For environment changes, run scripts/verify.ps1 and relevant scripts/verify-science.ps1 checks. Run the Docker workspace typecheck for TypeScript changes, plus actual feature tests when available. Health checks do not validate scientific models.

Never commit credentials, local data, generated dependency directories or build output. Update the owning documentation and docs/status.md with evidence. Preserve the archived masterplan unchanged. Contributions to original Senku code are under MIT; retain third-party notices.
