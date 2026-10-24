# Curated teaching docking worker

This adapter runs AutoDock Vina1.2.7 on two bundled receptor sites. It is an isolated educational comparison, not a biological activity, clinical, safety or affinity predictor. Only the allowlisted target IDs are accepted. Arbitrary protein uploads, external URLs, movable search boxes and generated executable workflows are excluded.

| Target | Public structure | Bound reference | Scope |
| --- | --- | --- | --- |
| Bovine trypsin | [3PTB](https://www.rcsb.org/structure/3PTB),1.70angstrom X-ray | Benzamidine BEN | Bovine digestion protein; monomer chain A |
| Streptavidin | [1STP](https://www.rcsb.org/structure/1STP),2.60angstrom X-ray | Biotin BTN | Biotin-binding teaching protein; biological tetramer, transformed chains A-D |

Neither target is a pathogen or toxin target. The streptavidin source organism is Streptomyces avidinii; [ATCC's strain listing](https://genomes.atcc.org/genomes/e5703e27ef2a484c) records biosafety level1. These files contain public structural coordinates, not organism handling instructions. RCSB structure entry metadata and coordinate data are used under [wwPDB data usage policies](https://www.wwpdb.org/about/usage-policies).

## Reproducibility

Raw RCSB PDB and assembly coordinate files are bundled and SHA256 checked by `prepare.py`. Receptor preparation occurs at image build, never by fetching a learner-supplied URL. Assembly models are assigned unique chains without moving their heavy atoms. The deposited bound ligand is preserved separately in its original coordinate frame. Waters, other ligands and ions are removed. Meeko residue templates prepare rigid receptor atom types/hydrogens. Missing or unsupported residue templates fail the build rather than silently deleting residues. A fixed18angstrom cube is centered on the reference ligand heavy-atom bounding box. Site residues have a protein heavy atom within5angstrom of the reference ligand.

Ligands are one connected, sanitized molecule with1–32heavy atoms, at most8rotatable bonds, absolute formal charge at most2, no radicals and only H/C/N/O/F/P/S/Cl. SMILES length is capped at160. The supplied protonation/tautomer state is used, with no pH or tautomer search. Seeded ETKDG embedding, MMFF minimization and Meeko ligand preparation precede a single-CPU seeded search. Exhaustiveness1–8, requested poses1–5 and positive31bit seeds are bounded again at the worker. A search may return fewer distinct poses than requested.

Scores are estimates in kcal/mol, not measured binding strengths. The protein is rigid. Crystal-pose similarity does not establish affinity or efficacy. Every result repeats these limitations and records input/source/receptor/preparation hashes, software versions, single-CPU/seed settings and the actual returned poses.

The image builds the same hashed Python base dependencies as existing numerics and molecular workers, then adds the hashed docking lock. Regenerate the lock with `senku-python-lock` against `services/workers/docking/requirements.in`. Runtime retains the shared authenticated subprocess supervisor, read-only filesystem, no external network, bounded temporary workspace, process group cancellation and wall deadline. Tests in `services/workers/tests/docking.py` use real computations and preserve the crystal coordinate frame for symmetry-aware redocking RMSD; that is a reference comparison, not experimental validation.

Primary implementation references: [Vina Python documentation](https://autodock-vina.readthedocs.io/en/latest/docking_python.html), [Vina basic docking](https://autodock-vina.readthedocs.io/en/latest/docking_basic.html), [Meeko receptor CLI](https://github.com/forlilab/Meeko/blob/develop/meeko/cli/mk_prepare_receptor.py).

## Pinned source bytes and dependency terms

| Source file | SHA256 |
| --- | --- |
| 3PTB.pdb | 288f7954d4d013fa8eab3808e1037e2958e2dcd12c9eca65a3f1014404a9f9a2 |
| 1STP-assembly1.pdb | 892478b3fbec8bb38fe9a2c5de12ad2b923b42327a43b61d2884d6c3fc59f3f9 |

Source downloads: `https://files.rcsb.org/download/3PTB.pdb` and `https://files.rcsb.org/download/1STP.pdb1`. The original 1STP asymmetric unit is archived separately for inspection. The biological assembly download is the actual streptavidin receptor source. Prepared receptor and preparation-script hashes are generated at image build and returned in each result.

Runtime docking pins: Vina 1.2.7, Meeko 0.8.0, RDKit 2026.9.1, SciPy 1.16.3, NumPy 2.3.5, Gemmi 0.7.4. Complete version/hash details are in `requirements.lock` and the inherited numerics/RDKit locks. The Senku MIT license does not relicense dependencies or structural data. Preserve upstream terms: [Vina license](https://github.com/ccsb-scripps/AutoDock-Vina/blob/develop/LICENSE), [Meeko license](https://github.com/forlilab/Meeko/blob/develop/LICENSE), [RDKit license](https://github.com/rdkit/rdkit/blob/master/license.txt), [SciPy license](https://github.com/scipy/scipy/blob/main/LICENSE.txt), and the wwPDB policy above.

## Reproduction and measured checks

Build with `docker compose -f compose.yaml -f compose.gemini.yaml --profile science build vina`, then start `vina`. Stream `services/workers/tests/docking.py` into `/tmp/docking-tests.py` with `docker compose exec -T vina`, and execute it with `python /tmp/docking-tests.py`. The test uses the existing local worker environment for authenticated requests without displaying its credential. It leaves temporary result files only.

On 2026-10-25, 47 real-worker assertions passed on the final isolated image. Seed 42, exhaustiveness 1 and up to 3 poses gave trypsin score -6.013 kcal/mol, 1 returned pose, 5.047 seconds; streptavidin -8.188 kcal/mol, 2 poses, 7.261 seconds. Repeated seeded docking payloads were identical. Symmetry-aware heavy-atom RMSD in the original crystal frame was 0.384 angstrom for trypsin/benzamidine and 0.580 angstrom for streptavidin/biotin. CalcRMS was used without fitting or superposing the predicted ligand. These are two redocking sanity checks for known ligands, not independent affinity validation, a guarantee for other molecules, or a hardware performance target. High-effort searches can reach the enforced wall deadline.

The 47 checks also covered invalid/unapproved targets, disconnected/oversized/unparseable/unsupported-element/radical ligands, invalid settings/seeds, arbitrary box and receptor rejection, worker authentication, active process-group cancellation and a 1-second wall deadline. Observed latency varies with host load.

The docking child alone has a 1536 MiB virtual address-space ceiling, while the container still enforces 1 GiB actual memory, 1 CPU and the normal read-only/no-network/capability restrictions. Other workers retain their 768 MiB address-space ceiling. The lower virtual ceiling caused severe search slowdown and a default-effort timeout even though resident memory stayed below the container cap; increasing virtual headroom restored completion without altering the search algorithm, scores or seeded coordinates. CPU time remains 65 seconds, wall time at most 60 seconds, output files at most 4 MiB, and descriptors/process counts remain bounded. `docking_limits.py` separately measures actual default and upper-effort completion and observed virtual/resident peaks.

Both additional authenticated protocol checks passed, bringing the real-worker total to 49 assertions:

| Streptavidin effort | Requested / actual poses | Wall seconds | Peak virtual KiB | Peak resident KiB | Best estimated score kcal/mol |
| --- | --- | --- | --- | --- | --- |
| 2, normal default | 3 / 2 | 11.296 | 785184 | 515160 | -8.188 |
| 8, upper bound | 5 / 5 | 23.806 | 784152 | 512716 | -8.217 |

The observed virtual peaks approach the old 786432 KiB ceiling, while actual resident peaks are about 503 MiB. These measurements support the docking-specific virtual headroom change; they do not promise equivalent latency or memory use for every accepted ligand. Other ligands retain the enforced timeout and failure states.
