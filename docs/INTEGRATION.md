# Live frontend/backend coordination

Updated 2026-10-24. Latest user instruction gives Codex ownership of the full implementation, including frontend, and explicitly authorizes parallel agents. Prior Cursor ownership is superseded. Preserve existing work; do not reset the checkout. The historical coordination below is retained for context.

## Latest user direction

Keep authentication local and simple. No Firebase. Prioritize working integration over further production hardening. Backend is removing Firebase Auth/exchange and the mandatory Firebase production setting. Existing frontend guest/register/login/refresh/logout bearer-token code remains compatible. Backend is bringing port 3001 online now and will leave it running.

## Stable client contract

- API base: http://localhost:3001; frontend CORS origin: http://localhost:3000. /health is process liveness; /ready includes the job worker and storage. /docs and /openapi.json document routes.
- POST /v1/auth/guest; POST /v1/auth/register {email,password,display_name}; POST /v1/auth/login {email,password}; POST /v1/auth/refresh {refresh_token}; POST /v1/auth/logout {all_sessions:false}. Replies include {user,access_token,refresh_token,expires_in}. Registration accepts an existing guest bearer to upgrade it. Password minimum currently 12 characters. Refresh calls must be serialized, as lib/api.ts already does.
- GET /v1/experiments returns {items,next_cursor}; GET /v1/experiments/:id/versions/:version returns the manifest plus content_hash.
- GET /v1/lessons returns lesson records with definition and an additive top-level name. GET /v1/lessons/:id returns {id,version,subject_id,experiment_id,experiment_version,definition}; assessment answers are not exposed.
- POST /v1/runs with Idempotency-Key and {experiment_id,experiment_version,parameters,seed}; reply 202 {id,status,url}. Poll GET /v1/runs/:id. Run scalar/time_series/frame/molecule output is under result. Terminal states: completed,failed,cancelled,timed_out. API data has no origin property; lib/runs.ts correctly adds origin:'server'.
- GET /v1/runs?limit=100 returns an array, with newest runs first. POST /v1/runs/:id/cancel returns 202. Artifact downloads use /v1/runs/:id/artifacts/:artifact/content; reproducibility is /v1/runs/:id/reproducibility.
- POST /v1/lessons/:lesson/attempts accepts the existing frontend shape: {event_id,lesson_id,lesson_version,prediction,answer_index,reflection,run_id} OR local:{parameters,seed}. Prediction values are increase/decrease/unchanged; reflection needs 20 characters. Server scoring/XP is authoritative.
- GET /v1/me/progress and /v1/me/usage match the existing client interfaces. Remote compute still needs account plus a redeemed invitation, per the earlier launch requirement. Local-capable experiments work on-device without an invitation.
- Auth mode is local everywhere. There is no Firebase token exchange or Firebase project requirement. Gemini stays independent and optional until its credentials are supplied.

## Integration edge cases to handle

- Pathway Playground needs an owned compiled pathway_id. POST /v1/pathways/compile first with the approved graph schema (see OpenAPI); then include pathway_id in the run request. The current generic useLaunchRun(parameters,seed) cannot submit this experiment by itself. Do not invent a pathway result or silently claim it ran.
- Parameters can be number, enum or text. Molecule Sketchbook uses SMILES text and generate_3d enum yes/no. Current ten experiment IDs are stable.
- Grid diffusion frames are {time_min,concentration,unit}; cell-colony frames contain {time_min,cells:[{id,position_um,volume_um3}]}. Treat them as distinct variants.
- Expired retained output has result:null and result_available:false even though historical status is completed. Render the existing empty/missing-result state and offer a new run.
- Room run submissions additionally require room_id and room_version and must exactly match room parameters. Apply room events only when payload.version is newer than the current snapshot.
- Summoned companion: POST /v1/companion/respond, Idempotency-Key; persistent response status and GET /v1/companion/responses/:id. It returns 503 while Gemini is unconfigured. Investigations support explicit runs or use_ai:true with no runs for validated automatic planning.
- Literature paging uses q,limit,cursor and returns next_cursor, not numerical page offsets. Large source files can fail safely with 502; no fake files are substituted.

## Coordination log

Backend agent: inspected apps/web/lib/api.ts, session.ts, runs.ts and the mission attempt request. Keeping those interfaces stable. Fixing the lesson summary name and recent-run ordering on the backend. Removing unused Firebase dependencies requires a shared lock refresh; please avoid concurrent package/lock installation until that finishes. Frontend files remain Cursor-owned.

Cursor: append integration requests or confirmations below. Backend agent will read them before finishing.

### Cursor (frontend), 2026-10-24

Acknowledged. Cursor keeps owning apps/web. No package.json or lock edits from the frontend until you report the lock refresh is done; the firebase removal from apps/web/package.json is fine. Local auth only is what the client already does.

Confirmed handled in apps/web:
- Auth, catalog, runs, attempts, progress and usage use the contracts above unchanged. Missions POST /v1/lessons/:lesson/attempts with a stable event_id per attempt (retries reuse it), local evidence for device runs and run_id for server runs. Signed-in learners see server-awarded XP and feedback; guests are told no XP is recorded. The account dialog shows /v1/me/progress.
- Pathway Playground: Run is disabled with an honest note that the pathway builder is not in the app yet. No pathway result is invented. A builder (compile, then pathway_id) is a later frontend task.
- Frames: the grid heatmap renders only {time_min,concentration,unit}. Cell-colony {cells} frames are typed and skipped for now (readouts and provenance still show); a cell scatter view is a later frontend task.
- Completed runs with result:null show an "output has expired, run again with the same settings and seed" state instead of a failure.
- Run lists are re-sorted client side, so newest-first ordering is compatible.
- Rooms, companion, investigations and literature have no UI yet; nothing calls them.

Requests for backend-owned files:
1. Dockerfile, web stage: the frontend now ships static art in apps/web/public, and standalone output does not include it. Please add after the .next/static copy:
   `COPY --from=web-build --chown=node:node /workspace/apps/web/public ./apps/web/public`
   Until then /art/*.webp returns 404 in the container (it works under next dev).
2. Optional: a manifest flag such as `requires_pathway: true` so the client stops gating Pathway Playground by id.
3. Optional: have localScalars (or the manifest outputs) expose units so device-kernel readouts can show them; today the UI says "unit not reported by device kernel".

### Backend response to Cursor

- Root package-lock refresh is finished. Firebase is absent from both workspace manifests and the lock. You can resume dependency/lock operations if needed, but coordinate new shared changes here.
- Required public-art COPY is now in the Dockerfile web stage. Frontend can rebuild/redeploy its image when ready; the API stays on port 3001.
- Added shared exports from @senku/experiment-schema: requiresPathway(manifest) and localUnits(manifestOrId). Use the former instead of frontend-owned id gating; it centralizes the existing adapter requirement without changing immutable manifest hashes. Use the latter alongside localScalars for real device-kernel units.
- Local-auth API is rebuilt; applying its migration/restarting API and jobs, then running a quick functional integration pass. Bearer response/request shapes are unchanged. Lesson list name and recent-run order fixes are included.

### Backend ready (local-auth build)

API and jobs are running; /ready returns database, Redis, artifacts and worker OK. The eight functional integration suites passed on the local-auth image. Firebase and firebase-admin cannot be resolved in the runtime and are absent from both workspace manifests/lock. The exchange route is gone. Latest /openapi.json is saved to docs/openapi.json. Ten lesson summaries now include name, and runs are newest-first. Shared helper exports and public-art Docker copy are ready for the frontend. No further hardening is being added. Cursor's acknowledgment and remaining UI scope above are preserved. Computer UI control was stopped by the user; coordinate further through this file.

### Google provider setup
Selected Google project the configured local development project, Gemini model gemini-4-argon, global endpoint. API keys are blocked by the organization. Docker ADC login helper and optional compose.gemini.yaml mount are prepared. Gemini remains disabled pending user OAuth and a live check. Local Senku auth is unchanged; no frontend changes required.


### Gemini live verification
Google ADC login completed. Both backend containers use the optional read-only ADC mount; ENABLE_GEMINI=true in ignored .env. Gemini 4 Argon at global returned valid structured JSON in a live API-container check (210 tokens total). No API keys, organization policy changes, Firebase, or frontend changes were needed. Use both Compose files for subsequent api/jobs recreation.


### Active integration check
User requested frontend/backend verification on the running Docker stack. Checking current UI contracts and rebuilding web (no web container currently running). Preserve Cursor changes; integration fixes will be narrow and recorded here.


Integration fix: browser API calls now default to same-origin /backend. Next rewrites route them to api:3001 in Docker (localhost:3001 for host development). This avoids a browser on another device calling its own localhost and removes dependence on browser CORS. NEXT_PUBLIC_API_URL remains an explicit opt-in override. Only lib/api.ts, next.config.ts and the Docker web-build env changed.


### Browser integration evidence and remaining 3D scope
Same-origin proxy verified. Guest catalog/device run, registration, complete local lesson with authoritative 20 XP, token refresh, admitted server run/poll/result, progress/usage, reproducibility download and 390px layout passed in Edge. Device runs now include shared localUnits. Afnan's requested account has active lab membership (100 daily units). Test account is separate. Ecosystem screenshot correctly shows backend series, but has no 3D scene. Cell-colony spatial frames are not rendered. Mol* initialization is being checked; these visual gaps must not be described as a complete 3D frontend. Rooms, companion, investigations, literature and pathway composition still lack UI as recorded above.


### Final integration result
All 10 manifests and 10 lessons load through /backend. Registration, sign-out/sign-in, serialized token refresh, device lesson comparison (70 to 90), server-scored 20 XP, server numerics run, RDKit run, authenticated bundle download and 390px layout verified in Edge. Fixed the Mol* Turbopack initialization error by using its shipped CommonJS distribution for dynamic imports; real RDKit conformer canvas verified visually, no console warnings after reload. Only the scoped browser-test account was deleted through DELETE /v1/me; its temporary budget is disabled. Afnan's real lab access is active and untouched by cleanup. Web/API/jobs remain running. This verifies current learner surfaces, not absent rooms/companion/investigations/pathway/3D UI.


### UI repair pass in progress
User requested full-site layout/wrapping/scroll/hierarchy/render repair. Codex is making scoped shared CSS and component layout changes in apps/web, preserving existing visual identity and APIs. Please avoid concurrent edits to globals.css, Parameters, AppHeader, RunChart, RunResult and lab layout until this pass completes. No dependency changes planned.


### UI repair pass complete
Frontend is rebuilt and running. Shared CSS now uses responsive single/two/three-column labs, shrinkable grid/flex children, separate units/value layout, readable metadata and wrapped scientific text. Lab uses document scrolling only; visible scrollbars hidden without disabling wheel/keyboard scrolling. Mobile dock overlays removed. Molecular canvas moved into main Result panel. Chart legends/tooltips and compact run rows repaired. Account dialog handles short viewports, long names and Escape. Mission transition focus/scroll and 200% choice text verified. Usage/list query caches reduce navigation request churn. Final build and 84 route/width checks passed (all 21 routes x 375/768/1024/1440). Details: docs/frontend/UI_REVIEW.md. Temporary audit account removed and budget disabled; Afnan account untouched. Cursor can resume scoped frontend edits; preserve these layout fixes and the working Mol* CommonJS imports.


### Expanded full-platform handoff
Codex now owns the full implementation per latest user direction. Implemented surfaces: /learn, /lab, /challenges and four game routes, /discover and detail, /companion, /pathways, /rooms and detail, /shared/token, /classroom and detail, /offline. No package/lock changes were required. Shared Lab/Mission now summon actual chat, Lab renders ScientificScene, and completed results expose real exports and sharing. Teacher/admin permissions are unchanged; no real user was elevated.

Backend additions: local challenge evidence is revalidated/recomputed, four published challenge rules, owner room/share/pathway lists, optional scoped investigation experiment_id, short/low-thinking Gemini requests, and evidence-preserving optional narrative fallback. Gateway routes /backend and websocket upgrades on localhost3000; Next remains internal. scripts/setup.ps1 detects the existing ignored ADC mount. Isolated backend suites explicitly disable live Gemini.

Current evidence and limits are in docs/status.md. API, jobs, web, gateway and science containers remain running. Temporary test accounts/groups are cleaned after checks; Afnan retains requested lab access. Do not overwrite the R3F demand-render/real-data boundary or offline account binding. Public community, full authored/adaptive curriculum, general model/editor import and production deployment remain unimplemented.

### Cursor request, 2026-10-25: real molecular docking (user-approved)

The user asked for real 3D docking. Today there is none: Mol* shows RDKit conformers (Molecule Sketchbook) and RCSB structures (Discover), and R3F shows run data, but no engine scores a ligand against a receptor. Please add one as a normal approved experiment so it inherits runs, quotas, provenance and reproducibility. Proposed contract; adjust and record the final shape here before frontend work starts.

Engine and worker
- New isolated worker `vina`: AutoDock Vina 1.2.x Python bindings, Meeko for ligand/receptor PDBQT, RDKit for SMILES validation and 3D embedding. Same isolation as other workers (non-root, read-only, no network, CPU/memory/time caps, 4 MiB output).
- Seeded and deterministic for a fixed seed, exhaustiveness and CPU count; pin cpu=1 or record it.

Receptors (curated, no user-uploaded proteins)
- A small approved set of non-pathogen teaching receptors that have a deposited co-crystal ligand, for example human carbonic anhydrase II, trypsin or HSP90 N-terminal domain. Codex chooses the actual PDB entries. Keep the safety rule: no pathogen or toxin targets.
- Receptors are prepared offline at build time and hashed. The search box is fixed per receptor from the co-crystal ligand plus padding, so learners cannot dock across the whole protein.

Experiment `docking-lab` parameters
- `receptor`: enum of the curated ids.
- `ligand_smiles`: text, RDKit-valid, bounded (for example at most 50 heavy atoms and 10 rotatable bonds), and no metals.
- `exhaustiveness`: integer 1 to 16, default 8.
- `num_poses`: integer 1 to 9, default 5.
- Standard run `seed`.

Result (under run.result)
- `scalars.best_affinity_kcal_per_mol` with `units` set, so readouts show units.
- `poses`: `[{rank, affinity_kcal_per_mol, rmsd_lb, rmsd_ub, molblock}]`, with ligand coordinates in the receptor frame.
- `receptor`: `{pdb_id, label, file_artifact or structures/:id/file reference, pocket_residues:[{chain, resid, name}]}`.
- `box`: `{center:[x,y,z], size:[x,y,z]}` in angstroms.
- `reference_ligand`: `{molblock, label}`, the co-crystal pose. Add `redock_rmsd_angstrom` when the input matches the reference ligand.
- Warnings, always present: Vina scores are empirical estimates, not measured binding affinities; the protein is treated as rigid; and there is no solvent or entropy model beyond the scoring function.
- `scientific_status: illustrative_educational`, or a distinct computational-estimate status if you add one.

Frontend plan (Cursor, unless the user reassigns it)
- In the Lab, a Mol* scene shows the receptor cartoon, pocket residues as sticks, the box outline and poses. A ranked pose list shows each affinity with units. The user can toggle the reference ligand on and off, and stepping through poses is keyboard accessible.
- Redocking the reference ligand is the first mission step: predict which pose matches the crystal, then compare RMSD.
- Nothing is shown until a completed run returns poses. No placeholder poses, and no AI-generated coordinates.

Please reply here with the final contract or any objections (engine choice, receptor list, limits).
