# Character and village cohesion

Players, character previews and all seven story/town NPCs share the Quaternius
avatar library. Rowan and Elara replace the old fixed hero bodies; Lina, Mira,
Iona, Borin and Vale wear role-specific outfits. Civilian roles carry no weapons.
NPC names and roles use the existing world nameplate renderer.

Equipment uses per-weapon palm offsets, handle centers, orientation and scale.
The staff uses the left-hand torch stance, the shield faces outward, and the rogue
carries the offhand knife in reverse grip. Finger poses hold through animation
changes. Armed upper-body poses blend with existing leg locomotion; jumps, hits,
attacks and defeat retain their existing transitions. The axe chop uses an authored
chopping clip. This does not introduce two-hand IK.

Five building recipes replace the identical cottage layout: stone Springhouse,
two-storey shop with supported balcony, long lodge with awning, tower-roof
watchhouse, and a rotated cottage. Roof origins and balcony handedness were
checked in the browser. Walls remain within the existing authoritative obstacles;
service locations and travel routes are unchanged. Mira's stall now sits beside
her shop.

## Assets and reuse

New modules come from the free CC0
[Quaternius Medieval Village MegaKit Standard](https://quaternius.com/packs/medievalvillagemegakit.html).
The acquisition script pins the source revision, reuses existing local textures,
and records output hashes in `ASSET_MANIFEST.json`. Run
`python3 scripts/acquire-village-details.py` to rebuild the additional modules.
Character animation assembly remains in `scripts/acquire-characters.py`.

Existing model instancing, materials, culling, animation mixing, labels and
character customization remain shared. Game startup no longer loads the four
legacy hero bodies. Unused new railing assets and the unused 6x6 roof startup
request were removed. Grip poses are prepared once, use no frame allocations,
and release their observer with the avatar. Unarmed actors add no grip observer.

## Audit and validation

Reviewed imports, unused runtime assets, shared helpers, model ownership and
observer cleanup. Assets load through the existing startup failure handling.
No new database queries, endpoints, server commands, dependencies or paid services.
NPC presets and asset paths are local constants; no new user-controlled URL or
markup path. Existing server validation and authority are unchanged.

Automated checks cover handle-to-palm alignment during hand movement/scaling,
unarmed equipment, missing joints, finger pose cleanup, valid independent NPC
uniforms, building wall footprints, packaged modules and required animation clips.
Browser visual review includes all four weapon classes, attack poses, NPC uniforms,
roof alignment, balcony geometry and shop placement. Gameplay browser checks cover
movement, combat, customization and quest interactions.

Validation for this pass: 218 unit/integration tests and 18 browser tests passed;
strict TypeScript unused-symbol checks, Prettier, asset hashes and production build
passed. The build retains the existing large-bundle warning. Review images and
logs are under the ignored `evidence/` directory, including `grip-*.png`,
`building-*.png`, `cohesion-tests.log` and `cohesion-browser.log`.
