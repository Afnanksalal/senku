# Scientific core and integrity

Source: masterplan sections 5, 9-10, 16, 20-25, 29-31. Status: intended scientific policies; no model has been reviewed or validated in this repo.

## Evidence classes

Clearly distinguish illustrative educational models, model-generated numerical predictions, literature-derived values, and measured data. A numerical curve is not automatically an experimentally validated prediction. Preserve assumptions, units, validity domain, references, solver warnings, and review status in Lab and exports.

Every experiment needs equations or explicit rules, input bounds and units, outputs, learning objectives, limiting-case/reference tests, numerical tolerances, citations where appropriate, and deterministic seed support where applicable. An energy index is not ATP concentration. Molecular shape is not molecular dynamics. Descriptors are not biological efficacy.

## Planned library registry

| Tool | Responsibility | Boundary / validation need |
|---|---|---|
| NumPy/SciPy | Numerical baseline, ODEs, statistics, postprocessing | Stability, units, tolerances, reference cases |
| Tellurium/libRoadRunner | Reviewed SBML kinetic simulations | Model support, solver settings, units, package compatibility |
| COPASI | Kinetic trajectories and analysis | Dedicated image; verify build-specific capabilities |
| COBRApy | Curated constraint-based metabolism | Objective/constraint assumptions and feasibility; not direct kinetics |
| PhysiCell | Approved multicellular educational scenarios | Heavy runtime; bounded resources and nonpathogenic presets |
| BioSimulators | Compatible SED-ML/COMBINE execution | Validate each simulator/format combination |
| RDKit | Sanitization, molecular depictions and descriptors | Benign scoped inputs; no efficacy inference |
| Mol* | Macromolecular structure viewer | Vetted PDB/mmCIF, quality/source metadata; not a solver |
| 3Dmol.js | Alternative lightweight molecule viewer | Select one primary viewer per scene |
| Ketcher | Chemical structure editor | Sanitize exported structures before worker use |
| React Flow | Typed species/reaction graph editor | Graph must validate and compile; drawing is not model validity |
| Europe PMC | Read-only literature discovery | Real retrievable sources, evidence metadata, untrusted retrieved text |
| RCSB PDB | Structure retrieval | Format, size, provenance, structure quality and caching |

Registry entries describe planned roles only. License review, exact releases, native compatibility, asset terms, and integration tests remain outstanding. Do not install the entire registry solely because it appears here.

## Publication gate

Before publishing an experiment: reviewed model identity/version; equations/rules and assumptions; parameter and output dimensions; input validation; runtime and version; known cases and tolerance evidence; provenance and limitations; safe category; allowed capabilities; applicable seed/replay behavior; verified references; accessible output description.

The masterplan's example digests and empty reference lists are placeholders. They are not deployable or approved scientific content. A literature citation can justify an assumption without validating the whole model.

## Biological scope

Use approved educational models, benign molecular work, noninfectious toy models, and precomputed public educational data. Exclude pathogen design, harmful-organism optimization, and operational harmful-agent experimentation. Enforce model/tool scope through policy and validators, not just prompt wording.
