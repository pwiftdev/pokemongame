# Third-party notices

## Quaternius models and textures

Creator: Quaternius. All seven packs below are licensed CC0 1.0 Universal. Attribution is not required; credit is provided voluntarily.

- [Ultimate Animated Animals](https://quaternius.com/packs/ultimateanimatedanimals.html): Deer, Stag, Fox, Wolf, Horse and Alpaca with authored skeletal animations.
- [Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html): 12 species and three matching evolutions, downloaded individually from the creator's official Google Drive folders.
- [Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html): animated Adventurer and Casual Hoodie player models.
- [Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html): trees, bushes, flowers, grass, mushrooms, and rocks.
- [Medieval Village MegaKit](https://quaternius.com/packs/medievalvillagemegakit.html): textured architectural modules, fences, vines, and village props.
- [Medieval Village](https://quaternius.com/packs/medievalvillage.html): the original windmill landmark, converted to GLB from the official OBJ and MTL download.
- [Fantasy Props MegaKit](https://quaternius.com/packs/fantasypropsmegakit.html): market stall, barrels, crates, benches, lights, and expedition props.

The player and environment files come from the Standard/free editions, acquired through the public `agentkaerf/FreeModels` mirror at the commit pinned in each manifest URL. Source pages and the full CC0 legal text are preserved in `assets/source/quaternius/`.

`ASSET_MANIFEST.json` records every shipped model, texture and rendered creature portrait, its source, byte size, and SHA-256 hash. Downloaded assets also record their pinned download URL. glTF buffers were losslessly packaged as GLB; external textures are shared between models and resized to a maximum dimension of 512 pixels. The original windmill OBJ and MTL are archived; its runtime GLB was converted with obj2gltf 3.2.0. Geometry and animation data are unchanged. `python3 assets/source/quaternius/acquire.py` verifies existing assets and restores missing files from those pinned sources (texture restoration uses macOS `sips`; windmill conversion uses `npx obj2gltf@3.2.0`). Quaternius portraits are transparent renders of the packaged models and keep the same CC0 license; regenerate them with `node scripts/render-portraits.mjs` while the Vite server is running. Everything is served locally with no runtime hotlinks.

The older Cute Animated Monsters files have been replaced. Island layout, terrain, paths, effects, interface, creature identities, and synthesized audio are original project code. The expansion includes Pokémon models as separately documented below.

## KayKit Adventurers

Characters and embedded equipment by Kay Lousberg, from [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers), CC0. Knight, Mage, Rogue and Barbarian use the official repository revision recorded in the manifest. The source character files contain weapon alternatives and 76 animation clips; 13–15 relevant authored locomotion, jump, hit and combat clips are retained per class and unused animation buffers are pruned with glTF Transform 4.2.1. The game selects the embedded equipment appropriate to each class. Regenerate with `python3 scripts/prepare-hero-models.py`. No paid pack was purchased.

## Pokémon companion models

Bulbasaur, Charmander, Squirtle, Ivysaur, Charmeleon and Wartortle are sourced from [Pokémon 3D API assets](https://github.com/Pokemon-3D-api/assets), at the revision pinned in the manifest. The source identifies these model rights as **Nintendo / Creatures Inc. / GAME FREAK inc.** These models and their rendered portraits are **not CC0 or MIT-licensed art**. The source repository's MIT software license does not grant Pokémon character or commercial asset rights. This project does not claim such rights or official affiliation.

Draco geometry was decompressed locally with glTF Transform 4.2.1 to remove runtime decoder downloads. Textures remain embedded. Bulbasaur includes authored animation clips; the other five models include skeletal rigs and use project-authored procedural joint animation. No claim of original authored walk/combat clips is made for those five models.

`node scripts/render-rpg-portraits.mjs` renders Pokémon and class portraits. `python3 scripts/build-region-models.py` builds snow, autumn, moonlit and sandstone material variants from Quaternius meshes. Derived assets retain their respective source rights. All runtime assets are served locally.

## Software dependencies

Pinned dependency versions are recorded in `package-lock.json`. Packaged dependency license and notice texts are included in `apps/client/public/legal/SOFTWARE_LICENSES.txt`, served at `/legal/SOFTWARE_LICENSES.txt` and linked from the in-game credits. They include the Babylon.js Apache 2.0 notices and licenses for the server and client libraries.
