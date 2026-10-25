# Molecular docking teaching workflow

## Scope

`/docking` is Molecular Match, an approved molecular experiment. It explores static ligand placement in a protein pocket, not cellular dynamics. The experiment is `molecular-docking`1.0.0, model `teaching-docking`1.0.0, isolated engine `vina`. Product copy uses Senku; method identities remain in scientific references and exported provenance.

Only bovine trypsin3PTB with benzamidine and streptavidin1STP with biotin are approved. Structures are pinned local source files with SHA256 checks at image build. Streptavidin uses its biological tetramer. Runtime cannot download a target, accept protein uploads, move the box or execute user code. Source records: [3PTB](https://www.rcsb.org/structure/3PTB), [1STP](https://www.rcsb.org/structure/1STP).

The fixed search is an18Å cube centered on the heavy-atom bounding-box center of the known ligand. Site residues have a protein heavy atom within5Å of the crystal ligand. These distances describe the deposited reference, not predicted hydrogen bonds or interactions of a submitted molecule.

## Inputs and outputs

Inputs are target, SMILES (up to160characters), search effort1–8, returned poses1–5 and seed1–2147483647. The compute boundary sanitizes the molecule again: one connected component, at most32heavy atoms, at most8rotatable bonds, supported organic elements, bounded charge, no radicals, supported conformer/minimization preparation. Invalid or unsupported molecules fail explicitly. Returned pose count may be smaller than requested.

Results include ranked coordinates and estimated scores in kcal/mol, prepared protein coordinates, the known crystal ligand, box center/dimensions, reference-site residues, input/settings and software/preparation/source hashes. Seeded search runs on one CPU. Exact replay depends on the same prepared assets, software and numerical environment; local image digest remains null unless the operator supplies the deployed digest.

Every result states that scores are estimates, not measured binding strengths, and the protein is rigid. Water, ions, protonation choices and protein flexibility limit interpretation. More negative scores rank poses within a setup. They do not establish binding, biological activity, safety or clinical value. A crystal overlay is a spatial comparison, not an affinity measurement or whole-cell model. [Method and preparation documentation](https://autodock-vina.readthedocs.io/en/latest/docking_basic.html).

## Platform integration

The ordinary authenticated run lifecycle provides admission, one simulation unit, idempotent submission, queue dispatch, cancellation, deadlines, output bounds, private artifacts and reproducibility export. The worker is non-root, read-only, has CPU/memory/process limits, no public ports, no credentials in child processes and only the internal compute network. Existing run records and retention policies apply.

Senku automatically prepares one educational reflection from a completed run using a separate lab unit. Only validated target/settings/scores/site facts enter its context; coordinate strings are excluded. Responses must retain rigid/estimate limitations and cannot invent contacts, RMSD, efficacy or measurements. Successful reflection replay is cached; explicit retries after terminal failure are separately labeled and charged. Further conversation uses the exact saved run.

The interface has a bounded custom protein selector, labeled controls, real loading/failure/cancel/offline/admission states, selected-pose coordinates, crystal and box toggles, keyboard camera controls, a 2D projection and text results. Coordinate-distance display bonds are visual aids, not inferred bond orders. Exports retain actual data and hashes.

## Rebuild and verification

Build/start: `docker compose -f compose.yaml -f compose.gemini.yaml --profile science up -d --build vina api jobs web`, then restart gateway after upstream recreation. The connection override is only needed for the configured local explanation service. No new public host or deployment is provisioned.

Dependency pins and hashes are in `services/workers/docking/requirements.lock`; preparation and source checks are in that directory. Backend tests: `apps/api/tests/docking.contract.cjs` and `apps/api/tests/docking.integration.cjs`. The integration harness uses real isolated database/queue/storage and explicitly substituted computation/explanations; solver and browser evidence are recorded separately in status.md. Infrastructure tests are not empirical biological validation.

Docking source/worker verification: run `./scripts/verify-docking.ps1` against the running isolated service. It performs real reference-ligand searches for both approved structures, deterministic replay, coordinate comparison, input/authorization rejection, cancellation and deadline checks. These are teaching/reference checks, not empirical affinity validation.

Docking has a60-second worker deadline and65-second API transport allowance. Other engine timeouts are unchanged. Its process virtual-address bound is1.5GiB to accommodate mapped scientific libraries; actual container memory remains capped at1GiB, CPU at1core, with CPU/file/process/descriptor limits retained. The old768MiB virtual bound caused severe search slowdown and was replaced only for this engine after measurement.


For actual drawing, saved compounds and independent batch comparisons, use the [molecule studio](molecular-workspace.md). The single-search interface remains available.
