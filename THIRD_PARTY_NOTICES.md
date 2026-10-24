# Third-party software and data

The root MIT license covers original Senku code and documentation contributed under it. It does not relicense dependencies, scientific tools, container bases, datasets, structures, fonts, artwork or trademarks.

Node versions/integrity records are in package-lock.json and services/molecule-editor/package-lock.json. Python versions/hashes are in services/workers/*/requirements.lock. Native source revisions are in their Dockerfiles. Each component retains its original license, notices and redistribution requirements.

MinIO is built from upstream source and retains its upstream license, copied into the runtime image. PhysiCell and the other scientific libraries retain their respective licenses. Review applicable terms and source-distribution obligations before distributing bundled images. Senku's MIT license does not make every dependency MIT-licensed.

Scientific sources and structures must retain provenance and required attribution. Use original mascot/artwork. Senku is not affiliated with Duolingo, Google or the creators of Dr. Stone. Naming and asset clearance remain release work.

Docking bundles pinned public3PTB and1STP structural coordinates with source URLs and hashes recorded in services/workers/docking/README.md. The docking environment adds AutoDock Vina and Meeko; their upstream licenses and preparation/data notices remain applicable. The worker README links upstream license texts and source structure usage policies. Its method and dependencies are not relicensed by Senku's MIT license.
