# Runtime configuration

Commit `.env.example`, not credentials or local configuration. The default clone starts without a cloud provider; a configured local development installation has exercised real connected requests. That evidence does not provision a project for another clone or certify a production deployment.

## Local secrets

`scripts/setup.ps1` generates unique database/storage passwords and execution/signing keys in ignored `.env`. Linux setup is described in [setup.md](setup.md). Use distinct random values of at least 32 characters for `SCIENCE_TOKEN` and `OFFLINE_SIGNING_KEY`.

Credential patterns are excluded from Git and Docker build contexts. Put local ADC under ignored `.secrets/gcloud/` and mount it at runtime. Never use a secret in a Docker build argument, `NEXT_PUBLIC_*` variable, client bundle, screenshot or issue.

## Connected Senku features

The API uses Google Vertex AI through Application Default Credentials. Set these in ignored `.env` using the actual project and a model available to that project:

```dotenv
ENABLE_GEMINI=true
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=your-supported-location
GEMINI_MODEL=your-accessible-model
GOOGLE_GENAI_USE_VERTEXAI=true
```

These are configuration examples, not project credentials or a promise that a model is available in every region. Check service enablement, IAM, model access, billing and credit eligibility in the operator's project. `GEMINI_API_KEY` is reserved in the template and is not consumed by the current Vertex integration.

On Windows, authenticate through the pinned CLI container, passing your project explicitly:

```powershell
./scripts/gemini-login.ps1 -Project your-project-id
```

Complete Google's sign-in and consent yourself. Enter the authorization code only into the local terminal, never into chat or an issue. The script stores ADC in `.secrets/gcloud/application_default_credentials.json` and grants the non-root backend read access. The script has a historical local default project, so always pass `-Project` for your installation.

Start or recreate API and jobs with the credential override:

```sh
docker compose -f compose.yaml -f compose.gemini.yaml up -d api jobs
```

Only the ADC JSON is mounted, read-only. Neither the web container nor scientific workers receive it. A production deployment should use an appropriate workload identity and least-privilege service permissions instead of a developer's long-lived local credential.

Cloud authentication is independent of learner authentication. Senku uses local accounts, and remote work additionally needs application-level admission. See [compute access](setup.md#accounts-and-compute-access). Group/member/global limits, concurrency and cancellation do not replace cloud billing alerts or provider quotas.

## Public origin, metadata and installation

Set `SENKU_SITE_URL` to the real public HTTPS origin before building and running the web image. Rebuild web after changing it because metadata, robots and sitemap content may be generated during the build. Missing, invalid, local or non-HTTPS values disable search indexing. Development falls back to `http://localhost:3000`; do not invent a public hostname.

Public pages have canonical metadata and raster share images. Private pages use `noindex` and generic preview text. Discord, WhatsApp, Facebook and X need publicly reachable HTML and images, and may cache previews. Localhost cannot supply public share previews.

The install experience depends on browser support and a secure context. A public PWA needs HTTPS. Saving a lesson pack is a separate action from installing the app; installation does not imply every lesson or conversation is available offline.

## Deployment controls

Local Compose defaults enable migration/catalog setup and bucket creation for convenience. For a deployment, provision secrets, schema and bucket separately; use `NODE_ENV=production`, `AUTO_MIGRATE=false` and `S3_CREATE_BUCKET=false`, with exact approved origins and appropriate proxy settings. Startup rejects incompatible production settings.

Keep databases, Redis, object storage and scientific workers private. Retain the worker resource/network boundaries. Configure backups and retention, restore verification, monitoring, billing limits and operator access. See [backend operations](backend.md) for the implemented controls and remaining deployment work.
