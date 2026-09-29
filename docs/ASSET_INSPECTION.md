# Runtime asset inspection

The runtime now uses Quaternius Ultimate Monsters, Ultimate Modular Men, Stylized Nature MegaKit, Medieval Village MegaKit, Fantasy Props MegaKit, and the original Medieval Village windmill. Exact files, source URLs, licenses, sizes, animation names, and hashes are recorded in `ASSET_MANIFEST.json`. The previous Cute Animated Monsters files are no longer shipped.

Twelve monster species and three corresponding evolutions are packaged as GLB with their original skeletons, textures, and animation tracks. Flying monsters use `Flying_Idle` and `Fast_Flying`; attack and hit states select the pack's `Headbutt`, `Punch`, `Bite_Front`, `HitReact`, or `HitRecieve` as appropriate. Every monster has a dedicated Death animation. Adventurer and Casual Hoodie player models use authored Idle, Walk and Run clips. Animated models blend into new clips.

The common model library shares templates and materials, clones actor skeletons, normalizes height with a separate placement pivot, and instances static scenery. If any model fails, loading waits for pending requests, disposes successful containers, and shows the existing island loading error. The player cannot enter a partially loaded scene. URLs are fixed local paths.

The creature atelier at `/inspect.html` previews the full roster and all six animation actions. `tests/browser/models.spec.ts` checks actual bone changes and 15 active animation clips for every action, plus blocked player, village, and nature downloads followed by successful reload. The existing UI test covers failed monster downloads. `tests/model-assets.test.ts` verifies inventory, checksums, GLB structure, local texture/material references, skeletons, and clip availability.

Current screenshots: `evidence/models-spawn.png`, `evidence/models-player.png`, and `evidence/models-monsters.png`, `evidence/models-meadow.png`, and `evidence/models-forest.png`. Historical screenshots and animation reports from the old roster are retained as historical evidence and do not describe the new pack.

Limitations: the windmill model is static. Shared environment textures are limited to 512 pixels for browser delivery. Terrain, water, paths, and gameplay effects remain engine geometry; the characters, vegetation, buildings, and props use authored assets.
