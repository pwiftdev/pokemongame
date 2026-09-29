# RPG expansion audit

This audit covers the expanded world and class/companion split. Earlier visual and gameplay reports describe the previous expedition build.

## Implemented

- World radius increased from 88m to 300m (11.62 times the land area), with eight named regions, continuous roads, level 1–20 encounters, regional landmarks and attunable travel waystones.
- Knight, Mage, Rogue and Barbarian creation. Four class abilities each, visible class equipment, authored locomotion, weapon strikes, spellcasting, guard and hit animation.
- Separate player health. Quaternius monsters are hostile enemies and cannot be captured. Bulbasaur, Charmander and Squirtle are actual Pokémon companions, with Ivysaur, Charmeleon and Wartortle evolution models.
- Assist, independent Attack and Follow commands. Companion contribution uses authoritative damage, cooldown, range, line-of-sight, session ownership and defeat reward paths.
- Quaternius Deer, Stag, Fox, Wolf, Horse and Alpaca wildlife. Animals use authored skeletal animations and are decorative, not combat targets.
- Existing collection migration preserves IDs, nicknames, experience, levels, evolution flags, team membership and economy. Class choice and unlocked waystones persist in the existing transactional profile record.

## Code review

Checked unused imports/locals, duplicated code and assets, asset errors/disposal, authoritative validation, persistence boundaries, shared geometry, render cost and existing architecture.

- Shared class and region definitions drive server rules and client presentation. Region landmarks, map rendering, wildlife, hero statistics and procedural companion motion are separate helpers.
- Reused weapons already embedded in KayKit files; removed separately downloaded equipment and duplicated external hero textures. Retained the authored clips each class uses (expanded to 13–15 in the subsequent combat-feel pass) and pruned unused animation buffers.
- New command variants use the existing strict Zod schemas, request IDs, session ownership, rate limits and transaction handling. Capturing hostile monsters fails before inventory consumption. Fast travel requires a nearby waystone, a discovered destination and peace. Waystone camps reject outgoing attacks and prevent enemies from following players inside.
- Profile normalization is deterministic and idempotent. It does not erase creature identity, progression, economy or collection entries. No new recovery or lease state machine was introduced.
- Room snapshots include nearby encounters; the client disposes creatures that leave the area. Scenery has distance culling, grass uses spatial instance batches, and wildlife rigs exist only near the camera.
- Camera raycasts first filter nearby enabled geometry and intersect that shortlist, avoiding full-scene picking on the enlarged map.
- All roads are checked against authoritative building/landmark collision. The first world walk found a road crossing the windmill; that route and a forest-tree junction were corrected.
- Asset loading failure disposes already-loaded scenery. Additional browser checks cover animal and Pokémon download failures.
- Every runtime asset is local and has a hash, byte size and explicit source/rights record. Pokémon art is explicitly distinguished from CC0 assets; the repository software license is not represented as an art license.

## Verification

TypeScript passes with unused-local/import checking enabled. All 14 browser tests pass against the production bundle, including the knight melee/passive-companion flow, multiplayer, asset failure recovery and durable onboarding. The six isolated gameplay scenarios also pass (three Pokémon captures, evolution, shared boss, elites, quests and reconciled persistence). All 54 unit tests pass, including persistence failure cases, migration, protected camps, road clearance and asset integrity. The regional keyboard walkthrough passed with no browser errors; sampled frame rates were 50–60 FPS at 1440×900 on this local Chromium/Metal setup. The production build passes with the existing large Babylon.js chunk warning. The production dependency audit reports zero vulnerabilities.

The current machine-readable results are in `evidence/rpg-gameplay.json`, `evidence/rpg-visual.json`, `evidence/combat-timing.json`, `evidence/server-gameplay-test.json` and `evidence/browser-results.json`. Reproduce using the corresponding scripts and `npm test`, `npm run typecheck`, `npm run build` and `npx prettier --check .`.

## Practical limits

This is an eight-region RPG expansion, not a completed MMO content catalog. Equipment is class-defined; there is no gear-drop progression or dungeon system. Wildlife is ambient. The original capital buildings and central landmarks have authoritative collision; regional set dressing and scattered vegetation remain traversable. Bulbasaur has source-authored animation clips; the other Pokémon use their real rigs with project-authored procedural motion. Pokémon asset rights are distinct from the CC0 packs; see `THIRD_PARTY_NOTICES.md`.
