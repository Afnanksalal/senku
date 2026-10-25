# Molecular workspace UI brief

## Surface and journey

The molecular workspace is a creator tool for learners. It is separate from guided missions. Learners draw a small molecule or enter its code, check and save it to a private collection, select molecule/protein pairs, and compare the resulting saved searches. The existing visual system, editor document boundary and molecular viewers are reused.

The primary mobile action is checking/saving a molecule or launching the selected comparison. The page stacks drawing, collection and comparison on phones. Names and notes are editable independently of structure checks. Saving a changed structure explicitly costs 1 lab unit; a comparison costs 1 unit per pair plus 1 automatic screen-level interpretation. Opening a row or switching a pose does not request another interpretation.

## Information and integrity

Collections are private to the signed-in account. Query keys contain owner IDs; switching away from a learner clears private drafts and notices. An anonymous or guest drawing survives the transition into an account in the same mounted workspace. Save actions use actual prepared molecule results, not strings labeled as validated by the browser. Batch members retain their own saved runs and snapshots.

Result rows are grouped by protein, never ranked across different proteins. The selected result opens actual saved 3D coordinates, crystal reference and pose controls. A second view can compare a different molecule against the same protein, without fitting or changing either coordinate frame. A 2D fallback and text evidence remain available through the existing viewer. CSV exports preserve numeric scores and neutralize spreadsheet formula prefixes in names.

Senku automatically interprets one terminal comparison with completed evidence. It uses a stable owner/screen cache and a server-safe idempotency key. An unavailable interpretation does not hide data. Explicit failed retries disclose their separate cost. Individual-result explanations remain deliberate actions.

## States and verification

The interface includes guest sign-in, admission denial, offline, empty collection, loading, invalid/unsupported molecule, queued/running, cancelled/failed/partial completion, expired result and success states. Errors appear beside their relevant actions. Fields have visible labels, 44px controls, 8px label spacing and 24px group spacing; all grid tracks can shrink without clipping.

UI/UX quality, UI/UX Pro Max and Duolingo writing/reference guidance informed this surface. TypeScript and UTF-8 checks pass. 29 durable lifecycle/export/idempotency assertions use explicit fixtures. Real editor, saved-compound, matrix and responsive browser verification follow the integrated deployment; no scientific validation or live provider success is claimed by these unit checks.

## Integrated verification

A temporary admitted learner created a real collection, checked and saved ethanol and benzamidine, then completed all four molecule/protein pairs through the UI and queue. Estimated scores were ethanol -2.563/-2.747 and benzamidine -6.085/-6.957 kcal/mol for trypsin/streptavidin respectively. These are computed teaching outputs, not measured affinity. One automatic comparison interpretation used the actual numbers with the rigid-protein, estimate and per-protein comparison limits. Reload and viewer interactions caused no new charged search or interpretation requests.

A name-only molecule update sent only name/notes, with no validation POST. Historical comparison names remained unchanged. The comparison CSV/JSON retained all four actual scores, seeds and run references. Two real coordinate canvases rendered side by side; crystal-overlay projection changed from 18 atoms to 9 for the selected benzamidine pose. The drawing document exported actual benzene SMILES into the host field without a save or compute request.

Cancellation stopped every member of a second comparison and generated no interpretation. Two later identical explicit comparison intents received distinct request keys and distinct screen IDs; both were immediately cancelled. Custom removal dialogs focused the safe action; cancelling preserved the main collection, while confirming removal of a separate empty test collection returned 200. No native confirmation dialog remains in this surface.

The rebuilt page passed 16 layout cases: setup and completed results at 320/375/768/1440 pixels, each at normal and 200% text, with no overflow or page exception. A final screenshot caught unequal grid stretching between comparison cards; start alignment was verified to put both canvases at the same y coordinate and applied as a two-property CSS correction. Final deployment retake belongs to the root integration pass.

42 durable UI lifecycle, export, request-key and account-boundary assertions passed. They explicitly verify abort/discard when the actor changes before or during a request, cleanup of subscriptions, and external cancellation. Test fixtures are identified as fixtures. Temporary account deletion and budget deactivation belong to the parent; no existing learner account was changed.
