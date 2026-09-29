# Sources checked during implementation

Checked 2026-09-29. Official documentation plus installed package definitions are the API references. Versions are pinned in package.json and package-lock.json; Colyseus server and browser SDK deliberately use the same 0.18 protocol generation.

- Colyseus server and rooms: https://docs.colyseus.io/server and https://docs.colyseus.io/room. HTTP server transport and authoritative room message handling.
- Babylon skeletons: https://doc.babylonjs.com/features/featuresDeepDive/mesh/bonesSkeletons. Actual locally inspected GLB skeletons and animation groups are used.
- Quaternius Ultimate Monsters: https://quaternius.com/packs/ultimatemonsters.html. Individual pack page declares CC0; primary download hit a public quota restriction. Alternate pack provenance is recorded in ASSET_MANIFEST.json.
- Kenney Nature Kit: https://kenney.nl/assets/nature-kit. Individual kit page declares CC0. Considered for coherent modular environment assets; authored procedural environment avoids additional loading overhead.
- Poly Haven: https://polyhaven.com/license. Reviewed as an environment lighting/texture source. No Poly Haven runtime asset is imported.

Imported files, license evidence, inspections, modifications, and hashes are recorded in ASSET_MANIFEST.json and THIRD_PARTY_NOTICES.md. Original procedural geometry, SVG interface icons, and synthesized audio have no runtime network asset dependency.
