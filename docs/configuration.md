# Runtime configuration

Google Cloud project/authentication configuration is the next integration step. The bootstrap has not called cloud AI APIs.

## Local secrets

scripts/setup.ps1 generates unique database and storage passwords in ignored .env. Credential patterns are excluded from both Git and Docker build contexts. Commit only .env.example with empty values/placeholders. Put any downloaded credentials under ignored .secrets/ and mount them at runtime; never COPY them into an image.

## Google integration

Prefer runtime service identity or Application Default Credentials for the GCP path. Check the actual project, region, model access and credit eligibility before enabling requests. An API key is an alternative only for a supported endpoint/authentication mode; do not assume a single key covers every Google service.

The template reserves GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, GOOGLE_GENAI_USE_VERTEXAI and optional GEMINI_API_KEY. The current API scaffold does not consume that key or mount a credential file. Implement the backend runtime secret wiring in the next step. No secret belongs in NEXT_PUBLIC_* or a client bundle.

Credits do not replace application budgets. Enforce invitation-only shared allowances, per-request limits, concurrency and cancellation before enabling expensive jobs or media generation.
