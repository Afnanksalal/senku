# Security

This is a development bootstrap, not a production-hardened service. Keep interfaces bound to localhost. Do not publish the stack until authentication, authorization, quotas and production isolation are implemented and verified.

Do not put credentials or sensitive vulnerabilities in public issues. A private reporting address has not been configured. Contact the maintainer through an existing trusted private channel; add a verified reporting contact before public release.

Keep API keys and service-account files out of Git, Docker build arguments, frontend code, NEXT_PUBLIC_* variables and logs. Use ignored configuration locally and runtime secret injection in deployments. Rotate exposed credentials; deleting a file in a later commit does not remove its history.

Retrieved papers, structures and tool output are untrusted data. Workers must not accept arbitrary code, privileged containers, unrestricted networking or a host Docker socket. See docs/ai-and-safety.md.
