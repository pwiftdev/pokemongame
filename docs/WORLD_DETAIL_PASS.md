# Regional world detail pass

The eight regions now use different terrain, landmarks, vegetation and atmosphere. Travel routes remain open and the server and browser share the same terrain and obstacle definitions.

| Region              | Environment                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Hearthwick          | Cottage gardens, market props, a springwater pond, fishing dock and chimney smoke                |
| Sunpetal Meadows    | Orchard rows, wildflower patches, millpond, reeds and grazing wildlife                           |
| Lanternwood         | Taller canopy groves, ferns, fallen timber, mushroom rings and a rocky cascade                   |
| Tideglass Reach     | Flooded stone court, broken colonnade, weathered gateways and a watchtower                       |
| Amberfall Expanse   | Rolling dunes, palms around an oasis, cacti, mesas, ancient bones and an expedition camp         |
| Moonfen             | Three irregular pools, dead trees, lilies, fishing jetties, reeds, blue haze and drifting lights |
| Frostveil Highlands | Alpine terrain, snow-covered rock faces, a walkable frozen lake, falling snow and a camp         |
| Kingsward Vale      | Autumn groves, fenced wheat/corn/pumpkin fields, wagons, a millpond and a southern watchtower    |

Stone paving stays in the village and ruins. Other roads are worn trails blended into the terrain. Shared water boundaries prevent walking into deep water; the frozen lake remains traversable. Large authored landmarks have shared collision footprints. Small dressing objects remain decorative.

The read-only `/world-tour.html` preview uses the production renderer and offers one view of each region. It is linked from Field notes & credits. It does not create a player or connect to multiplayer.

## Art and performance

28 additional locally served CC0 models total approximately 3.56 MB before transfer compression. Sources: [Quaternius Ultimate Stylized Nature](https://quaternius.com/packs/ultimatestylizednature.html), [Quaternius Pirate Kit](https://quaternius.com/packs/piratekit.html), [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) and [Kenney Castle Kit](https://kenney.nl/assets/castle-kit). Acquisition scripts, palette adjustments and hashes are recorded in the asset manifest and third-party notices.

Ground plants and crop rows use spatial batches with thin instances. Large scenery uses shared model instances and distance culling. Low quality retains sparse nearby ground cover and reduces atmospheric particles. Road-distance lookups use a spatial index; terrain colors are reused rather than allocated per vertex. Reduced motion disables ambient motes and smoke and freezes water, wind, birds and cascade motion.

On the local Apple M4 / 16 GB machine at 1440 × 900, the 30-Pokémon fixture recorded 59.96 FPS high / 59.98 FPS low, with frame-time p95 of 17.8 ms / 18.0 ms. The previous high-quality baseline was 58.07 FPS / 19.1 ms. Total scene vertices fell from about 20.97 million to 7.11 million; measured JS heap fell from 385 MB to 317 MB. Draw calls increased from 421 to 455 on high quality because the scene has more material and prop variety. Sparse ground cover is now retained on low quality. Measurements are specific to this machine and scene.

## Validation and audit

- All 128 unit tests passed, along with type checking, unused-code checks, the production build and Prettier. Four browser scenarios passed: defeated-player movement/reconnect/healing, Pokémon capture/evolution, story interactions, and a two-browser companion duel.
- Unit checks cover road clearance, encounter/destination placement, blocked lakes/landmarks, frozen-lake movement, terrain continuity and route slopes.
- The existing model-integrity checks verify every packaged file, local textures and manifest hash.
- The world-tour script captures all eight regions and records renderer errors and metrics. The separate 30-Pokémon benchmark measures high and low quality.
- A 60-second, 16-client local multiplayer check passed with roughly 9.8–9.9 snapshots/second per client and a 3.97 ms server tick p95. This is a server test, not 16 rendered browsers.
- Audit covered unused imports/code, duplicated placement and material logic, disposal, shared collision authority, model source integrity and runtime requests. A marsh pool that crossed a route was relocated; invalid wildlife homes were excluded; landmark sizes and imported palettes were corrected during visual review. No new database queries, endpoints or external runtime services were added.

This pass uses the existing Heroku web dyno and database. It requires no additional servers or paid assets. Device-specific rendering measurements and screenshots are kept in the ignored `evidence/` directory; they are not a guarantee of frame rate on other hardware.
