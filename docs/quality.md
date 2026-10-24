# Verification and acceptance

Source: masterplan sections 16-18, 24-25, 29-30. No checks in this document have yet been executed against a product.

| Area | Required evidence |
|---|---|
| Science | Units/dimensions, known limits, reference cases, tolerances, convergence/stability, seed replay where applicable, conservation where relevant |
| Adapters | Allowed formats, pinned images, diagnostics translation, invalid input rejection, hashes, cancellation, timeout and retry behavior |
| Learning | Prediction/manipulation/explanation, progress persistence, prerequisite behavior, mastery/scoring, idempotent XP |
| Learn/Lab continuity | Same experiment/model/engine identity and preserved input state; comparisons use real run outputs |
| Evidence/AI | Retrievable sources, PDB record identity, run-linked quantities, schema/tool validation, injection resistance, critic warnings |
| Offline | Actual disconnected cached lesson, local outputs, truthful remote unavailability, reconnect reconciliation without duplicate credit |
| Accessibility | Keyboard flow, focus, screen-reader descriptions, text alternatives for plots, reduced motion, non-color status, scalable text |
| Devices/performance | Representative low-end mobile evidence, responsive fit, lower-quality and 2D fallback, measured frame/resource behavior |
| Security | Auth/role/ownership checks, quotas, egress restriction, isolation, bounded outputs, no arbitrary execution |
| Operations | Production build, service health, queue behavior, logs, backups and restore, artifact integrity |

## End-to-end product gate

Complete a mission; open its exact model in Lab; run and compare two parameter sets; inspect units, assumptions and provenance; export replayable results; finish an actual cached offline lesson; reconcile progress once; inspect a cited AI report based on real jobs. Expanded scope adds pathway compilation/execution, a sourced molecular structure, and teacher assignment/progress.

## Honest reporting

Distinguish planned, implemented, tested, and validated. A UI smoke test does not validate a scientific model. A build pass does not verify runtime worker isolation. Mark demonstrations/mockups/precomputed samples clearly. Unavailable optional engines must remain visibly unavailable or offer an explicitly labeled educational model. Do not claim unlimited compute or offline execution of remote engines.

## Evidence format (proposed)

For each release check record requirement, version/commit, environment/device, input/seed, expected result and tolerance, observed result, artifact/log reference, pass/fail, and remaining limitation. Define runnable scripts with the implementation rather than documenting imaginary commands now.
