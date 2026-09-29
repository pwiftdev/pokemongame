# Play quality audit

This pass addresses camera control, combat feedback, terrain and lighting, and the field interface. It builds on the packaged Quaternius models.

## Reviewed and corrected

- Camera: removed conflicting built-in pointer controls. Left/right drag and Q/R orbit work, clicks remain distinct from drags, menus release captured input, and zoom retains its preferred distance after geometry clears. Picking uses CSS coordinates so reduced rendering resolution does not offset selections. Terrain height sampling replaces expensive terrain triangle raycasts; model obstruction checks remain.
- Combat: effects start on accepted server events. Incoming strikes, hit flashes, damage numbers, elemental projectiles, status halos, guard and healing have explicit feedback. Guard visuals follow the companion. Authoritative cooldowns survive rejected commands. Client eligibility explains range, safe areas, full health, target and duel restrictions; server validation remains authoritative.
- Enemy timing: ordinary creatures telegraph a fixed ground area for 900 ms. Damage checks current position, line of sight, ownership, safe zones and encounter bounds when the cast resolves. Stun interrupts a wild cast. Existing boss rules, persistence and rewards are reused.
- Rendering: repeat addressing is explicitly set on the generated terrain texture. Paving follows shared terrain height, including the arena, with smooth circular borders. Labels and combat text explicitly blend texture alpha when fading. Environmental shaders receive elapsed animation time instead of epoch timestamps to preserve float precision. Static instances share materials; instanced shadow reception is set on source meshes. Grass uses thin instances and respects low quality. Temporary combat meshes and textures are capped and disposed; pointer listeners are removed on teardown. Hit colors are reused across frames and animated models blend between clips. Reduced motion freezes environmental animation and limits effects.
- Stable controls: unchanged target, interaction and duel markup is retained across snapshots. A browser regression checks that the duel Accept button remains attached before clicking it.
- Reuse and file size: camera input, effects, spell shapes, health bars, sky/water, fire, ground texture, minimap and ability eligibility have separate helpers. One roster maps both in-world models and generated portraits. Obsolete starter glyph styling and the unused procedural shape field were removed. Creature descriptions now match the actual models.
- Security and architecture: no new endpoints, database queries, credentials, remote runtime assets, or dependencies. New snapshot fields expose only combat timers. Attack, capture, duel, ownership and progression checks remain on the server. User text stays escaped in HTML. Asset source, license, byte size and hash are recorded in the manifest.
- Source recovery: downloaded model acquisition still uses pinned URLs and hashes. Three additional stone building models and a brick prop replace the wooden ruin arch. Portrait generation is reproducible with `node scripts/render-portraits.mjs` while the Vite server runs; the temporary rendering page is removed after generation. Missing portraits produce a regeneration instruction in the acquisition script.

## Verification

- 46 unit tests passed; TypeScript also passed with unused code/import checks.
- All 11 browser tests passed, including two independent players completing a duel and the stable Accept-button regression. After animation blending, the camera, accepted/rejected cast and full monster animation checks were repeated successfully. See `evidence/browser-full-results.json` and `evidence/browser-results.json`.
- Six isolated authoritative gameplay scenarios passed: all twelve species captured, cooperative two-phase boss, progression, rewards, reconnect and ledger reconciliation. See `evidence/server-gameplay-test.json`.
- A real network client dodged a telegraphed strike; guard reduced incoming damage from 6 to 2. See `evidence/combat-timing.json`; rerun with `npx tsx scripts/combat-timing-test.ts`.
- The full browser walkthrough covered combat, taming, collection, three biomes, boss defeat and free healing with no page errors. See `evidence/visual-walkthrough.json`.
- Low-resolution mouse selection and a high-quality visual tour passed with no page or console errors. Local Chromium reached about 60 FPS at 1440 × 900. See `evidence/quality-review.json` and `evidence/quality-*.png`.
- All 123 packaged assets were hash-verified: 63 models, 45 textures and 15 portraits, totaling 25,009,194 bytes before transfer compression.
- Prettier and the production build passed. The built application also passed a fresh-browser smoke test for portraits, camera rotation and guard feedback, with no page or console errors; see `evidence/production-smoke.json`.

This remains a desktop browser game. Local performance checks do not establish mobile performance, long-session memory stability, or sixteen simultaneously rendered players. Babylon's shared bundle remains large; the production build reports its existing size warning.
