# Pokémon overhaul

## Scope and architecture

The roster contains 51 Pokémon across 17 selected evolution families, separate from the twelve hostile monster definitions. Every species has six base stats, one or two real types, a seven-move expedition learnset, evolution rules, catch rate, rarity, habitat, time/weather availability, temperament, locomotion, size and an original field entry. The eight island regions all have named Pokémon habitats; the original quest encounters remain in place.

`pokemon.ts` owns species data, `pokemon-types.ts` the 18-type chart, `pokemon-moves.ts` the 91-move library, and `pokemon-rules.ts` the pure stat, damage, learnset and evolution rules. The checked-in `pokemon-*-source.json` files contain factual PokéAPI snapshots. Learnsets, evolution levels, nature coverage and move status effects are expedition adaptations; alternate branches outside this roster are not included. No new dependency or runtime external data service was added.

Legacy hero elements still drive hero presentation. They map to Grass, Fire, Water, Rock, Electric and Psychic when hero abilities hit Pokémon, including dual-type multipliers and immunity. Hero attacks against existing monsters retain their established element balance. Pokémon damage uses physical/special stats, STAB, dual-type effectiveness including immunity, critical hits and bounded 85–100% variance through the existing room hit, threat, aura and defeat paths.

## Progression and persistence

The level cap stays 20. The expedition stat formula uses an effective battle level of `3 × level + 10`, capped at 100. HP is `floor((2 × base + IV) × effectiveLevel / 100) + effectiveLevel + 70`; other stats use the standard base/IV component plus 5 and a nature multiplier. The extra HP supports continuous real-time combat. IVs are deterministic from the creature's random UUID; six natures provide neutral, offensive, defensive and speed variation. These are deliberate expedition adaptations, not a full reproduction of the mainline rules.

Profiles retain creature UUIDs, nickname, XP, team, active selection, balance, inventory and quest state. An idempotent `dataVersion: 1` migration replaces legacy evolved flags with actual evolved species, preserves HP percentage (including fainting), and assigns stable IVs and a neutral nature. A Pokédex records seen and caught species and claimed milestone rewards. Health changes reuse the existing batched profile persistence path.

Evolution uses the existing transaction and ledger, with a distinct reference for each creature and starting species. Level stages unlock at 6 and 12; Eevee needs a purchased stone and Magneton needs the ruins. Evolution costs 90 PD, recalculates stats, updates the Pokédex and emits presentation metadata only after the transaction applies. Request deduplication and capture uniqueness remain in `db.ts`; no new recovery or lease state machine was introduced.

## Companions and combat

The companion brain scores ready moves by damage, type matchup, range and whether a status is already present. Low health raises healing and guarding priority. Each companion has an authoritative position, own cooldowns, aura holder, pending cast and health. Movement keeps formation, steers around collision, catches up, approaches a move's ideal range and moves sideways out of telegraphs. Passive orders cancel unreleased casts. Companions can intercept nearby enemy attacks, faint, be revived, or be replaced with a healthy teammate. Quick swaps have a ten-second cooldown. Per-creature move cooldowns survive swaps and replacement of an active session. Level-up healing preserves fainted state. Cooldowns are room/session state rather than durable timers across server restarts.

The companion action bar shares the existing action-slot and cooldown-sweep UI. Ctrl+1–4 commands a specific equipped move; Shift+1–3 swaps teammates. The Companions panel shows nature, all six stats and IVs and lets the player equip learned moves outside combat. The server validates ownership, learnset, range, cooldown, sanctuary and duel restrictions.

Move metadata supplies shape, anticipation, travel speed, recovery, animation and VFX keys. Effects distinguish arcing rocks/seeds, water and light beams, vine/melee lashes, segmented electric arcs, wind vortices, cones and ground eruptions. Variants use type, size and move identity. They share the existing effect/material lifetime manager, with reusable meshes and a bounded active-effect budget. Some similarly shaped moves intentionally share visual vocabulary; this is not 91 bespoke hand-animated effects.

## Habitats and motion

The world cycles through six minutes of day and four minutes of night, with deterministic weather periods. Ghosts and Cleffa's line appear at night; Dragonair needs rain. Common species form small groups, evolved/rare species have fewer spawn slots, and encounters roll a 1/512 shiny chance. Shiny Pokémon retain their status when captured and show gold/electric glints. Ambient decisions run twice per second per Pokémon, with cheap movement between decisions.

Skittish Pokémon flee, curious ones approach, territorial ones warn for two seconds before attacking, sleepy ones nap and permit a prepared sneak capture, and playful ones chase nearby peers. Wild Pokémon react to both trainers and their living deployed companions. Ambient poses include feeding and drinking. Flying, floating, swimming and burrowing locomotion are stylized presentations on the existing terrain; this release does not add underwater navigation or deformable ground.

The renderer uses authored clips where available and procedural fallbacks for idle, idle variation, walk, run, two attacks, special, hit, faint, celebration and sleep. Fallbacks include weight shift, anticipation, follow-through and secondary tail/ear/wing motion. Ground motion adjusts clip speed and terrain tilt, and yaw interpolates. This is procedural approximation without inverse kinematics or exact foot planting.

Every Pokémon uses a species-specific GLB, loaded on first use and cached per scene. Temporary primitive rigs appear only while loading or after a failed asset request. Distant models stop animation; temporary rigs also reduce part count. Existing world terrain/foliage culling remains active. Portrait generation explicitly awaits each GLB before rendering.

## Capture and Pokédex

The server commits capsule consumption and ownership before emitting the result. Presentation metadata supplies success, one to three shakes, duration, species and shiny state. The client shows an arcing capsule, absorption, shakes and break-out or confetti plus a saved “Caught!” card. The client never decides ownership. Recovered or duplicate transactions cannot award another creature or consume another capsule.

P opens the Pokédex, with silhouettes for unseen species, habitat/time/weather hints, and caught milestones at 10, 25 and all 51 species. Milestones use the existing ledger and claim deduplication.

## Models and defeat recovery

All 51 species have proper, distinct 3D assets from the same pinned Pokémon 3D API source as the original starters, with matching rendered portraits. The additional 45 models replace the previous primitive species and generic portraits. `ASSET_MANIFEST.json` records source URLs, rights, sizes and hashes. The artwork remains rights-reserved as documented in `THIRD_PARTY_NOTICES.md`. Skeletal models retain their rigs; ten source species use meshes without skeletal rigs with whole-model motion. Numbered bone names are normalized for procedural joint animation. Dragonite uses eleven authored action clips; pruning unused animation buffers reduced its GLB from 5.84 MB to 1.54 MB.

Defeated explorers can walk and animate normally after returning to town, including after reconnecting with zero HP. Combat remains health-gated, and a defeated player in an active duel stays immobilized. Free healing at the Springhouse restores the explorer and their team through the existing server transaction; no new recovery state machine or persistence path was added.

## Verification

Local verification on 30 September 2026 uses the production client build and real PostgreSQL/Colyseus servers. All required commands passed. A final targeted browser replay also checks the modal-layering polish.

| Command                                                  | Result                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `npm run typecheck`                                      | Passed                                                                        |
| `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` | Passed                                                                        |
| `npm test`                                               | 125 tests across 19 files passed                                              |
| `npm run build`                                          | Passed; Babylon vendor chunk still triggers the existing size warning         |
| `npx prettier --check .`                                 | Passed                                                                        |
| `npm run test:combat`                                    | 10 checks passed                                                              |
| `npm run test:combat-systems`                            | 12 checks passed                                                              |
| `npm run test:story`                                     | 6 checks passed                                                               |
| `npm run test:first-session`                             | 9 checks passed                                                               |
| `npm run test:network`                                   | 10 checks passed                                                              |
| `npm run test:gameplay`                                  | 6 checks passed, including the corrected stale quest check                    |
| `npm run test:pokemon`                                   | 9 isolated-schema integration checks passed                                   |
| `npx playwright test`                                    | 21 passed; no skipped, unexpected or flaky tests                              |
| `npm run test:render`                                    | 30 visible Pokémon; high 59.99 FPS / 17.5 ms p95; low 59.98 FPS / 17.6 ms p95 |
| `LOAD_SECONDS=60 npm run test:load`                      | 16 connected clients for 60.099 seconds; passed                               |

The 16-client room measured **0.852 ms mean / 2.046 ms p95 / 15.024 ms maximum tick time**, with 9.78–9.95 snapshots per second per client. These are local server measurements, not a claim about Heroku or rendered multiplayer FPS. The stress script deliberately submits invalid range, cooldown and duplicate reward commands; those rejections are expected.

`test:pokemon` uses an isolated PostgreSQL schema and real Colyseus commands, with a Node-only clock preload to exercise the transition into night. It covers AI and commanded moves, cooldowns, faint/revive, swapping, curious/sleepy/playful behavior, capture shakes/break-out/success and durable evolution. Pure tests cover the type chart, damage, IVs/natures/stats, learnsets, evolution methods, migration, all temperaments, availability and capture presentation.

`pokemon-benchmark.html` is a deterministic rendering fixture: 30 moving Pokémon in the production island renderer, with the same terrain, lighting, models and animation systems. It does not connect to a server or modify saved gameplay. `test:render` measures high and low quality at 1440 × 900 and waits for all 30 proper GLBs to finish loading and records the actual GPU, frame percentiles, loaded and visible Pokémon, draw calls and memory. Network capacity is measured separately with 16 real clients.

Rendering was measured on **Apple M4 / 16 GB RAM**, Chromium's ANGLE Metal renderer, at **1440 × 900**. After 30 seconds on each quality setting, the final 600-frame window recorded:

| Quality | FPS   | Mean frame | p95      | p99      | Visible Pokémon | Draw calls |
| ------- | ----- | ---------- | -------- | -------- | --------------- | ---------- |
| High    | 58.07 | 17.04 ms   | 19.10 ms | 20.10 ms | 30              | 421        |
| Low     | 59.96 | 16.67 ms   | 17.50 ms | 17.80 ms | 30              | 391        |

Initial load, including all 30 GLBs, was 3.281 seconds, with 17.9 MB transferred and a final JavaScript heap of 385.2 MB. There were no page errors. Both quality settings meet the approximately 60 FPS / p95 below 20 ms target on this reference Mac. The fixture includes normal scenery occlusion and counts enabled Pokémon inside the camera frustum; it does not claim that every mesh is completely unobstructed. It does not simulate 30 simultaneous attacks or benchmark low-end phones.

The screenshots were opened and reviewed, including the habitat, commanded move effect, capsule arc, caught card, Pokédex, evolution reveal, companion stats and the 30-Pokémon performance scene. Evidence is saved locally under `evidence/` (ignored by Git):

- `overhaul-verification.json`, `overhaul-browser-results.json` and `overhaul-*.log`: command results.
- `pokemon-systems-test.json`, `load-test.json` and `render-benchmark.json`: measured integration/load/rendering evidence.
- `pokemon-habitat.png`, `pokemon-battle-vfx.png`, `pokemon-capture.png`, `pokemon-caught.png`, `pokemon-pokedex.png`, `pokemon-evolution.png`, `pokemon-companion-stats.png`: gameplay screenshots.
- `performance-high.png`, `performance-low.png` and `overhaul-screenshot-review.json`: performance scene and review notes.

The overhaul was deployed to the existing Heroku testing app on 2026-09-30 using a source archive. Source changes remain uncommitted.

## Code audit

The final audit covered unused code/imports, duplicate paths, helper boundaries, runtime cost, error handling, ownership checks and save compatibility. TypeScript's unused checks pass. Companion movement, combat orchestration, habitat decisions, stats, portraits, effects and panels have focused helpers; combat impacts still use the room's existing hit, aura, threat and defeat paths. The action bar reuses existing slots and cooldown sweeps.

No dependency, database table, endpoint or recovery state machine was added. Seen entries and companion health use batched profile saves. Capture, evolution and Pokédex rewards use existing transactional mutation and ledger deduplication. Commands validate slots, ownership, health, learned moves, cooldowns, range and sanctuary/duel restrictions. UI input remains escaped; generated species/type/asset names come from the checked-in catalog. The clock override is only loaded explicitly by the isolated integration test.

Audit fixes include preserving move cooldowns across swaps and session replacement, preventing evolution stones from ordinary item consumption, keeping fainted Pokémon fainted on level-up, matching hero elemental attacks against Pokémon's real dual types, cleaning up temporary evolution actors and pooled effects, and retaining primitive rigs when a deferred GLB fails. Browser review corrected overlapping companion controls, uniform move icons, circular unseen portraits, the capture-card close action and duplicate evolution notifications.

Browser assertions now cover all eleven habitat pins and twelve shop items, including evolution stones. The older gameplay harness now checks the current expedition content instead of the removed `coast-path` quest. Full story progression is verified separately. Follow-mode checks allow projectiles already released to finish; they still reject new casts after the stop order. Interrupt checks match the intended attacker, and leash checks observe the retreat itself so a completed reset is not missed.

### Model and defeat follow-up audit

All 51 model paths resolve from one shared species mapping; generic inline portraits and the missing-model manifest were removed. Source assets retain local textures and require no remote Draco decoder. Import preparation initializes five rigs from their authored first pose, selects Blastoise's retracted cannon variant and retains source metadata needed for correct framing. Runtime model bounds account for skeletal poses. Temporary loading/error rigs remain disposable and share the existing asset cache; completed model loads expose readiness for portrait generation and the benchmark.

The follow-up passed 125 unit tests, strict unused checks, the production build, Prettier and 12 focused browser checks covering defeat/reconnect/healing, model failures, movement, combat, capture/evolution and multiplayer. Database-backed browser fixtures now close their shared pool once per worker. All 51 portraits were rendered from loaded GLBs and visually reviewed. No endpoint, database query, dependency, hosting tier or persistence state machine was added.
