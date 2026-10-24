# Bootstrap dependency choices

Selected during authorized repository setup: npm workspaces, Node 24, TypeScript 5.9, Next/React web, NestJS API, Radix primitives with custom UI, ECharts, Mol* as primary molecule viewer, R3F/Three/Drei, GSAP, React Flow, IndexedDB helpers, Yjs and Socket.IO. Drizzle/PostgreSQL for future persistence. Google Gen AI SDK and Firebase SDKs are available; auth design remains to be implemented. Firebase SDK installation does not provision a project or enable anonymous sign-in. S3 adapter is available for local MinIO.

Packages and direct versions are in workspace manifests; lockfile owns transitive versions. No Lucide dependency is intentionally added. No paid asset-generation SDK is included. Canvas 2D is built into the browser; PixiJS and a second molecular viewer are unnecessary until a concrete workload justifies them. Scientific Python families are isolated to avoid native version conflicts.

MinIO upstream image pulls were unavailable; its local image builds source at commit 07c3a429bfed433e49018cb0f78a52145d4bedeb. Docker Desktop was installed per-user with WSL2. Python 3.11 is used for isolated engines; direct versions are chosen for that runtime, not blindly from latest tags.

Dependency audit remediation: require multer 2.5.0, grpc-js 1.14.6, CommonJS-compatible uuid 11.1.1, and esbuild 0.25.12 specifically under the legacy Drizzle loader. Verify the resolved graph and builds after installation; do not use forced audit downgrades.

Ketcher is isolated in services/molecule-editor with React 18 because miew-react still requires it. Main web/R3F uses React 19. A separate browser document and validated messaging will be required for integration; do not mount the two React versions together.
