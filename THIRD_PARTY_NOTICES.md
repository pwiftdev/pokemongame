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

The older Cute Animated Monsters files have been replaced. Island layout, terrain, paths, effects, interface, creature identities are original project code. Audio recordings are separately credited below. The expansion includes Pokémon models as separately documented below.

## KayKit Adventurers

Characters and embedded equipment by Kay Lousberg, from [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers), CC0. Knight, Mage, Rogue and Barbarian use the official repository revision recorded in the manifest. The source character files contain weapon alternatives and 76 animation clips; 13–15 relevant authored locomotion, jump, hit and combat clips are retained per class and unused animation buffers are pruned with glTF Transform 4.2.1. The game selects the embedded equipment appropriate to each class. Regenerate with `python3 scripts/prepare-hero-models.py`. No paid pack was purchased.

## Pokémon companion models

All 51 species in the Pokémon catalog are sourced from [Pokémon 3D API assets](https://github.com/Pokemon-3D-api/assets), at the revision pinned in the manifest. The source identifies these model rights as **Nintendo / Creatures Inc. / GAME FREAK inc.** These models and their rendered portraits are **not CC0 or MIT-licensed art**. The source repository's MIT software license does not grant Pokémon character or commercial asset rights. This project does not claim such rights or official affiliation.

Draco geometry was decompressed locally with glTF Transform 4.2.1 to remove runtime decoder downloads. Textures remain embedded. Authored game clips are used for Bulbasaur and Dragonite. Dragonite retains eleven relevant authored clips with unused animation buffers pruned. Other species use procedural joint or whole-model motion where suitable authored actions are absent; ten source models use meshes without skeletal rigs. No claim of authored walk/combat clips is made for these procedural motions. Restore models with `python3 scripts/acquire-pokemon-models.py`.

`node scripts/render-rpg-portraits.mjs` renders Pokémon and class portraits. `python3 scripts/build-region-models.py` builds snow, autumn, moonlit and sandstone material variants from Quaternius meshes. Derived assets retain their respective source rights. All runtime assets are served locally.

## Temporary fallback geometry and factual data

All 51 species have distinct packaged GLBs and portraits rendered from those models. Original primitive geometry in `pokemon-placeholder.ts` is used only while a model loads or if its request fails. These temporary fallbacks do not replace any missing catalog asset. Original fallback geometry does not grant rights to Pokémon character designs. Capture and evolution sounds use the CC0 audio recordings credited below.

Species numbers, types, six base stats, heights and catch rates; move types, categories, powers, accuracies and PP; and the modern 18-type chart were fetched from [PokéAPI v2](https://pokeapi.co/docs/v2/) on 2026-09-30. `scripts/data/import-pokemon.mjs` caches every response locally and regenerates the checked-in factual JSON snapshots. The game makes no runtime requests to PokéAPI. Expedition descriptions, habitats, learnset timing, cooldowns, move shapes, evolution requirements and balance adjustments are project-authored adaptations. PokéAPI software licensing is not represented as a license to Pokémon artwork or characters.

## Software dependencies

Pinned dependency versions are recorded in `package-lock.json`. Packaged dependency license and notice texts are included in `apps/client/public/legal/SOFTWARE_LICENSES.txt`, served at `/legal/SOFTWARE_LICENSES.txt` and linked from the in-game credits. They include the Babylon.js Apache 2.0 notices and licenses for the server and client libraries.

## Interface font

The current typography uses Pixelify Sans, Chakra Petch, and Silkscreen as documented below. The shared pixel globe is derived from the user-provided UI cheatsheet; it is not part of the CC0 model packs. The previous Press Start 2P font has been replaced.

## Regional environment expansion

28 additional CC0 environment models are packaged locally from [Quaternius Ultimate Stylized Nature](https://quaternius.com/packs/ultimatestylizednature.html), [Quaternius Pirate Kit](https://quaternius.com/packs/piratekit.html), [Kenney Nature Kit](https://kenney.nl/assets/nature-kit), and [Kenney Castle Kit](https://kenney.nl/assets/castle-kit). They provide birches, maples, dead trees, wildflowers, palms, cliffs, docks, bones, reeds, lilies, cacti, farm crops, camp supplies and masonry. Quaternius downloads use the pinned mirror revision in the manifest; Kenney archives use the versioned URLs recorded there. No paid assets or remote runtime downloads are required.

Restore these models with `python3 scripts/acquire-world-models.py`. It embeds textures, limits Quaternius textures to 512 pixels and applies `scripts/style-world-models.py` to harmonize selected prop materials with the island palette. All geometry retains its source CC0 license. Regional terrain, water, ice, paths, atmosphere, particle effects, and placement code are original project work.

## Music and sound recordings

All shipped music and sound recordings are CC0 1.0, served locally. The full creator, source and download list is bundled at [AUDIO_CREDITS.txt](apps/client/public/legal/AUDIO_CREDITS.txt). `ASSET_MANIFEST.json` includes output and original-source SHA-256 hashes; `scripts/data/audio-sources.json` pins downloads and selected archive members.

- RandomMind: medieval inn, exploration, harvest, battle, victory and defeat music; river/wave recording.
- troubadour: Fantasy Song Pack Volume 1 (Wandering Woodlands, Fairy Lights, Bells of Winter).
- Thimras: park birds, river and wind recordings. LokiF: swamp ambience. AntumDeluge: fire crackling. Kresiek The Furry: rain loop.
- Kenney: Impact Sounds, Interface Sounds and RPG Audio. rubberduck: 80 CC0 RPG SFX. artisticdude: RPG Sound Pack. bart: Ice Spells.
- Fantozzi, sliced by qubodup: sand footsteps. Peludo / [RNAn](https://rnan.itch.io/): water splashes.

Files are normalized, resampled, peak-limited and MP3-encoded. Ambient excerpts have crossfaded seams; short effects have leading silence trimmed; result stingers and water steps are shortened. Creature vocalizations are adapted fantasy effects, not official Pokémon cries. Rebuild with `python3 scripts/acquire-audio.py` (ffmpeg, ffprobe, bsdtar). See [audio system](docs/AUDIO_SYSTEM.md).

## UI reference fonts

Pixelify Sans (500–700 variable), Chakra Petch (500, 600, 700), and Silkscreen (400, 700) are served locally from the font assets embedded in the user-provided World of Pokemon UI Cheatsheet.html. Licensed under SIL Open Font License 1.1. License copies: `apps/client/public/legal/pixelifysans-OFL.txt`, `chakrapetch-OFL.txt`, and `silkscreen-OFL.txt`. Official sources: [Pixelify Sans](https://github.com/google/fonts/tree/main/ofl/pixelifysans), [Chakra Petch](https://github.com/google/fonts/tree/main/ofl/chakrapetch), [Silkscreen](https://github.com/google/fonts/tree/main/ofl/silkscreen).

The town's varied roofs, plaster and stone walls, balcony, floor and supports also
come from Quaternius's CC0 Medieval Village MegaKit Standard. The pinned source,
local textures and output hashes are recorded in `ASSET_MANIFEST.json`; rebuild
these additions with `scripts/acquire-village-details.py`.
