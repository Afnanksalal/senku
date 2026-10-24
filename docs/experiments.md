# Experiment catalog

Source: masterplan sections 5, 10, 21-24, 29-30. All entries are planned and unimplemented. Equations, reviewed sources, and numeric acceptance tolerances remain content-authoring work.

| Experience | Learning/input focus | Planned execution | Output / critical caveat |
|---|---|---|---|
| Save the Cell | Oxygen, glucose, demand; limiting resources | Local educational model; optional curated COBRApy comparison | Illustrative resource/energy index and timeline, not validated ATP prediction |
| Enzyme Explorer | Substrate, enzyme quantity; saturation | SciPy kinetics; vetted SBML via RoadRunner or COPASI | Rate curves/trajectories; resolve rate and concentration units before authoring |
| Ecosystem Rescue | Nutrients, light, temperature; pond oxygen | Educational SciPy ODE | Nutrient/oxygen trajectories; assumptions and calibration explicit |
| Genetics Lab | Parent genotypes and sample size | Local seeded probability model | Ratios and sampling histogram; distinguish expected and sampled outcomes |
| Population Dynamics | Growth rate and carrying capacity | Engine not assigned in plan | Population trajectories; choose equation and time units explicitly |
| Diffusion Playground | Diffusivity and initial conditions | Browser JS/WASM or SciPy | Heatmap; specify boundary conditions, grid/time-step stability, conservation |
| Pathway Playground | Species, reactions, parameters | React Flow -> typed validation -> SBML -> RoadRunner | Network, trajectories, exported SBML; reconcile editable graphs with approved-model policy |
| Metabolism Explorer | Resource constraints | Curated toy model in COBRApy | Flux distribution, feasibility and solver status |
| Cell Colony | Multicellular patterns | Approved PhysiCell preset | Spatial frames and population summaries; remote heavy workload |
| Molecule Museum | Public protein structure exploration | RCSB PDB -> Mol* or 3Dmol.js | Structure, annotations, record and quality metadata; visualization, not dynamics |
| Molecule Sketchbook | Benign molecule editing | Ketcher -> RDKit | Sanitized structure, depiction, descriptors |

## Shared experience contract

Each substantive lesson asks for a prediction before manipulation, changes a real model parameter, shows quantitative feedback, and asks for an explanation/reflection. Lab opens the same experiment/model version and state. Controls map to declared parameters, not animation-only props.

## Candidate first slice

Enzyme Explorer is a working proposal because the expanded demo and continuity criteria use it. It must first have a reviewed educational equation, coherent dimensional convention, shared local runtime, reference cases, actual plots, replay/provenance, and accessible controls. This is a sequencing recommendation, not an approved MVP reduction. The full masterplan remains preserved.
