# Molecule studio

`/molecules` is a working molecular design and comparison workspace, separate from lessons and missions. Learners can draw or import a structure, retain validated compounds in private collections, and run independent docking searches against approved teaching proteins.

## From drawing to evidence

1. Draw atoms and bonds, import a MOL/SMILES structure, or use the manual molecule-code field. Use this molecule transfers the actual drawing into the code field. Drawing and local import/export do not spend lab units.
2. Create or choose a private collection. Check and save runs an actual molecular validation/conformer job, then saves its canonical structure, formula, descriptors and provenance. This costs 1 lab unit. Renaming or adding notes to an unchanged structure is free.
3. Select saved compounds and one or both approved proteins. A comparison contains at most 8 molecule/protein pairs, each with the same recorded effort, pose count and positive seed settings.
4. Follow queued, searching and terminal results. Each pair is a separate computation, not simultaneous multi-ligand binding. A failed or cancelled member does not become a fabricated result.
5. Inspect completed poses in 3D, compare the crystal reference, or open two molecules against the same protein side by side. Coordinates stay in the saved protein frame. Text results, 2D views, camera buttons and downloadable evidence remain available.

The targets and fixed binding boxes are the same curated trypsin/streptavidin sites documented in [docking.md](docking.md). Structures are not physical substances, validated medicines or evidence of biological effects. Whole-cell dynamics, arbitrary receptor uploads and pathogen/toxin design are outside this workspace.

## Bounds and costs

Collections are limited to 20 per account and 20 compounds per collection. Docking-compatible compounds use at most 160 SMILES characters, 32 non-hydrogen atoms and 8 rotatable bonds, with bounded charge and no radicals. Supported elements are H, C, N, O, F, P, S and Cl. The drawing tool can describe a wider range of chemistry; unsupported structures cannot be saved as docking-ready compounds. The server requires an owned, completed validation of the exact submitted structure and checks the actual chemistry diagnostics.

Each pair reserves 1 simulation unit. Batch admission is atomic: a budget failure cannot leave a partially admitted matrix. Waiting jobs remain queued with reserved units until the single docking slot is available. Cancelling queued work releases its reservation; already-started work remains charged under the existing platform policy.

One automatic Senku reflection costs 1 additional unit when a comparison is terminal and retains completed evidence. It interprets actual saved scores/statuses with rigid-protein and estimated-score limitations. It does not rank different proteins, infer selectivity or invent contacts and measured affinity. Successful/active reflections are deduplicated server-side for the account and screen, including different client request keys. Individual-result explanations are deliberate additional actions with their own displayed cost.

## Saved work and comparison

Collections, compounds and comparisons are account-scoped. Account changes abort pending workspace requests and discard responses that no longer belong to the expected account. Existing search snapshots retain their names, structures, inputs and run references after a collection is edited or removed. Deleting an active comparison requires stopping it first. Normal run and artifact retention still applies; expired output is shown as unavailable, not recomputed silently.

Result rows are grouped by protein and labeled as estimates in kcal/mol. Values do not establish binding strength, safety or efficacy. CSV exports preserve numeric values and neutralize spreadsheet formula prefixes in text. JSON exports retain actual member states, settings and run references. Individual pose coordinates and reproducibility records remain available from the saved run.

## Drawing isolation

The real drawing document is served locally through `/editor/` in an isolated browser document. Its engine, scripts, styles and worker assets do not call an external drawing provider. The bridge checks source window, origin, per-mount session, request ID, protocol version and message/payload bounds. It never accepts executable JavaScript. See [the service documentation](../services/molecule-editor/README.md) for the editor-only parser CSP exception, licenses and packaging.

An imported SDF currently loads its first structure. It does not silently import a compound library. If drawing cannot load, manual input remains available. Cold offline reload is not claimed: saving, validation and docking require a connection.

## Verification

Durable tests cover private CRUD, validation evidence, quota rollback, historical snapshots, account export/deletion, screen reflection, queue serialization, cancellation, request ownership, safe exports and editor message boundaries. The editor browser suite actually draws, imports and exports a structure through its local worker.

Real local end-to-end evidence includes saved ethanol/benzamidine compounds, a 2-by-2 completed matrix against both teaching proteins, a single grounded screen reflection, linked 3D/2D comparisons, verified exports, free metadata edits, cancellation and repeat user intents. Detailed current results are recorded in [status.md](status.md) and [the frontend brief](frontend/MOLECULES_BRIEF.md). These checks validate implementation behavior, not empirical affinity or clinical performance.
