# Aster Isle art direction

Warm late-afternoon adventure, composed from cream stone, honey timber, weathered teal roofs, sage grasses, and cool forest shadows. UI uses deep ink-green, parchment, subtle rules, ample spacing, and restrained gold highlights. Element colors always accompany text labels.

Scale: one world unit is approximately one meter. Trainers stand about 1.9 units; companions 0.8–2.5 units, boss visibly larger. Town sightline leads from expedition board to meadow windmill, luminous grove, then coastal observatory. Fixed collision proxies are shared by renderer and server. Use restrained rough surfaces, softened directional light, ambient fill, and atmospheric haze.

Creatures are genuine locally packaged skeletal glTF assets from one CC0 pack. Distinct silhouettes take priority over recolors. Skeletal walk/idle/hit/attack/defeat clips, target rings, readable cast effects and a gold elite/boss treatment provide feedback.

Budget: ≤30 MB initial compressed transfer, 16 real network clients per room, 20 Hz simulation / 10 Hz snapshots. Repeated plants should use instances and quality presets. Target 60 FPS at 1080p is a goal, not an unmeasured hardware claim. Actual browser and server evidence belongs in evidence/.

Runtime palette follows cream plaster, coral roofs and turquoise sea. Characters, trees, plants, architecture, and props use authored Quaternius models. Static scenery uses instances; actors share geometry and materials while retaining independent skeletons. Terrain and paving preserve the authoritative island layout. See ASSET_MANIFEST.json for the current inventory and byte sizes.
