# Full game audit — 30 September 2026

The next work should fix room admission and recovery first, then reduce database and network work, then improve world composition and the compact HUD. More assets alone will not solve the remaining visual problems.

This audits the current working tree, including its existing uncommitted changes; HEAD alone does not represent the deployed game. Application code was not changed, committed, or deployed during this audit. Reproduction scripts and logs are local in `evidence/audit-*`.

## Repair status

The first implementation pass is documented in [Audit fixes](AUDIT_FIXES.md). The findings below preserve the original audit evidence; they are not a claim that every defect remains present. Database/simulation separation, network deltas, and the larger HUD/world composition work remain open.

## Findings, ordered by priority

### 1. P1 — Unauthenticated requests can create running worlds

**Confirmed locally.** A single request to `/matchmake/create/island` with an invalid token and an untrusted Origin returned HTTP 200, a room reservation, and a new room already ticking with zero players. The response also allowed that Origin. No WebSocket connection was needed.

The `/api` rate limit and Express origin middleware in [index.ts](../apps/server/src/index.ts) do not protect this framework-managed route. Authentication is an instance method in [room.ts](../apps/server/src/room.ts), line 401, so it runs after allocation. Each allocation initializes the world and simulation. Repeated requests can waste the small server's CPU and memory. Expiring unused reservations limits each room's lifetime, but not the rate of allocation. This finding concerns resource admission; it does not demonstrate access to another player's profile.

**Fix:** authenticate and validate origins before room allocation; apply admission limits to all matchmaking paths and cap active/reserved rooms per identity and trusted client IP. Reuse the existing token validation and limiter. Colyseus provides a static authentication hook specifically to authenticate before creating a room. Check the installed version's hooks when wiring limits. [Colyseus authentication documentation](https://docs.colyseus.io/auth/room).

**Verification:** invalid credentials and origins allocate zero rooms; burst requests are bounded; valid public joins, room codes, and reconnects still work. Evidence: `evidence/audit-room-admission.json`. Only one invalid room-creation request was used; production was not probed.

### 2. P1 — An idle database connection failure can crash the server

**Reproduced in an isolated local process.** [db.ts](../apps/server/src/db.ts), line 12, constructs a pool without an `error` listener. Terminating only that reproduction process's own idle PostgreSQL connection produced an unhandled pool error and exit code 1. The running development and production servers were not terminated.

**Fix:** handle pool background errors centrally, report database availability, and let the pool discard broken connections. Add bounded connection and statement/lock waits. An error listener handles idle failures; it does not make failed transactions succeed. Preserve receipt-based reconciliation for ambiguous commits. [node-postgres pool documentation](https://node-postgres.com/apis/pool).

**Verification:** idle disconnect, active-query disconnect, unavailable database, pool exhaustion, and recovery without a process crash or duplicate reward. Evidence: `evidence/audit-pool-failure.ts` and `.log`.

### 3. P1 — A saved duel result can leave the second player locked in duel mode

**Reproduced with fault injection.** [duels.ts](../apps/server/src/duels.ts), lines 118–144, marks a duel finished, then clears each player's state and awaits a profile refresh inside the same loop. If player A's refresh fails, player B keeps `duelId`. Retrying `finishDuel` immediately returns because the duel is already finished. Expiry removes the duel record without clearing that remaining player reference.

The durable match result is intact, but companion orders, loadout changes, and other checks continue treating B as in a duel until reconnection.

**Fix:** clear both participants' local combat state independently of profile reads, and make result delivery/profile refresh retryable after completion. Reuse `recordMatch`'s durable result rather than award again.

**Verification:** failures before commit, ambiguous commit, either profile refresh failing after commit, socket loss, player replacement, and repeated completion. Evidence: the first case in `evidence/audit-repro.test.ts`; retry was explicitly tested.

### 4. P2 — Advertised level-10 duels are only partly normalized

**Confirmed by code and a reproduction.** [duels.ts](../apps/server/src/duels.ts), line 102, initializes level-10 resources, but [room.ts](../apps/server/src/room.ts), lines 591 and 1155, uses the actual collection-derived hero level for resource limits and ability unlocks. A level-1 mage is still denied a level-2/3 ability during the advertised level-10 duel. Resource regeneration also uses the real level.

**Fix:** use one shared effective combat-level helper for the server's duel limits/unlocks and the client's action bar/tooltips. Keep persistent progression unchanged. Test unequal-level opponents across all four classes, entry, and exit. Evidence: the second case in `evidence/audit-repro.test.ts`.

Separately, the duel announcement says to command the companion, while `petMove`, `pet`, and companion simulation explicitly disable this during duels. The arena currently behaves as hero combat. Bring the instructions into agreement with that behavior, or implement companion PvP through the existing combat paths if Pokémon battles are intended.

### 5. P2 — Database latency blocks the whole room's simulation

**Confirmed architectural coupling; production stall duration was not measured.** [room.ts](../apps/server/src/room.ts), lines 363–376, serializes commands and simulation on the same promise chain. Hero attacks and dashes call `update()` even for an empty persistent mutation; health saves also run inside the tick. [db.ts](../apps/server/src/db.ts), line 135, takes a row lock, inserts a permanent receipt, and rewrites the full profile for each such mutation.

A slow query stalls movement, combat, and snapshots for everyone in that room. The current tick timing starts after queue wait, so its reported p95 does not capture the entire delay. Receipts also grow indefinitely, including health-save receipts generated every 1.5 seconds while dirty.

**Fix:** bound database waits first. Measure queue delay and snapshot gaps. Separate transient combat sequencing from durable inventory/economy work, retaining explicit replay protection and shared-encounter serialization. Keep durable receipts for captures, purchases, and rewards. Do not simply expire every receipt or remove awaits: both can reintroduce duplicate actions and races.

**Verification:** delayed/failed database operations with 16 clients, recovery, stale-session replacement, ambiguous commits, and post-ack local failure. Any new ownership or lease mechanism must also cover lease loss and crash boundaries.

### 6. P2 — Optional scenery failures prevent entering the game

**Confirmed by the browser suite.** [models.ts](../apps/client/src/render/models.ts), line 30, rejects the entire library when any initial asset fails. [scenery.ts](../apps/client/src/render/scenery.ts), line 75, eagerly loads every regional scenery pack. [world.ts](../apps/client/src/world.ts), line 204, rejects world creation on a failed library, keeping Start disabled. Existing tests explicitly confirm this behavior for animals, nature, village, and hero assets.

**Fix:** define a small required startup set, load distant regions progressively, and retry optional files without throwing away a usable scene. Keep required hero assets guarded. Reuse the existing model library's pending-request deduplication and disposal handling.

### 7. P2 — A failed Pokémon download is not retried for that actor

**Confirmed by code inspection; automatic recovery is not covered by the current fallback test.** [creatures.ts](../apps/client/src/render/creatures.ts), lines 108–134, performs one deferred load and leaves the procedural fallback after failure. An actor still on screen is never upgraded after connectivity returns. Another instance may fetch the same species successfully, but it does not replace the original actor's fallback. Leaving interest range or reloading can recreate it.

**Fix:** bounded retries shared by species, with interested actors notified when the real asset becomes ready. Cancel callbacks on disposal. Test failure → connection recovery → replacement on the same actor, plus concurrent requests and disposal while loading.

### 8. P3 — HTTP errors and missing files have misleading responses

**Confirmed locally.** A missing `.glb` returns HTTP 200 with the application HTML because [index.ts](../apps/server/src/index.ts), line 126, uses an unrestricted SPA fallback. A 20,042-byte session request returns 500 instead of a useful payload-size response; the error handler classifies errors using message text instead of their status/type.

**Fix:** return real 404 responses for missing assets/API routes, limit HTML fallback to application navigation, and use typed error/status handling for malformed JSON, size limits, authentication, and service failures. The oversized-request probe alone does not establish a body-limit bypass.

## Performance and database improvements

These are measured opportunities or code-level costs, not promises of a particular FPS gain.

| Area                 | Evidence                                                                                                                                                                                                                                                                | Recommended change                                                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network payload      | The existing same-day 16-client/60-second load run received 143.5 MB of application JSON: about 149 KB/s per client. This is before transport framing/compression. Wilds are filtered to 100 units, but all players and repeated static fields are still sent at 10 Hz. | Measure encoded bytes, then send changed state and separate static spawn/species data. Reuse the existing nearby-snapshot path; add recovery/full-snapshot coverage before relying on deltas.                                     |
| Rendering            | Existing M4/1440×900/30-Pokémon fixture: high 59.96 FPS, p95 17.8 ms, 455 draws; low 59.98 FPS, p95 18.0 ms, 429 draws. Low reduces active geometry substantially but only about 6% of draw calls.                                                                      | Preserve current instancing/culling. Add actual distance geometry LOD and reduce material/submesh passes, then test a weaker device and sustained combat. These figures are prior same-day evidence, not a fresh audit benchmark. |
| Startup/memory       | The same renderer fixture transferred 20.76 MB and used roughly 317 MB JS heap; GPU memory is additional and was not measured. Libraries retain loaded species until scene disposal.                                                                                    | Stream regional assets, use a bounded cache for unused templates, and measure a complete world traversal before deciding cache limits.                                                                                            |
| Full-profile traffic | Every successful `update()` sends the entire collection/profile, including no-op persistent actions.                                                                                                                                                                    | Send profile changes only when persistent data changes; split frequent combat state from collection data.                                                                                                                         |
| Health copying       | `carryHp()` loops saved creatures and calls `.find()` in the runtime collection for each entry: quadratic work as collections grow.                                                                                                                                     | Build one ID → creature map per save and reuse it.                                                                                                                                                                                |
| Leaderboard          | `leaderboard()` joins all match history with an OR condition and aggregates on every public request, despite wins/losses already being maintained.                                                                                                                      | Use maintained counters with an appropriate index and a short cache; preserve the current eligibility/tie rules. Verify plans on representative data.                                                                             |
| Duel reward queries  | `recordMatch()` queries the same opponent-pair count twice and calculates a winner-count for the losing player.                                                                                                                                                         | Calculate the pair count once and daily wins only for the eligible winner. Consider a winner/time index after checking query plans.                                                                                               |
| Profile storage/UI   | Collection arrays and receipt rows have no bounded growth strategy; the collection panel renders every stored creature.                                                                                                                                                 | Add collection search/filtering and pagination; define receipt retention by command semantics rather than blanket deletion.                                                                                                       |

## UI and world direction

The desktop layout tests pass down to 800×600 at 125% scale. That proves reachability and selected non-overlap checks, not visual comfort. Inspection of `evidence/ui-layout-800-1.25.png` shows large HUD blocks consuming much of the view, abbreviated ability names, and a notification covering the target hint.

- Give short screens a deliberate compact combat layout: smaller unit frames, a collapsible quest tracker, quieter navigation, and a toast area clear of combat feedback. Keep one consistent place for status, interaction, and errors.
- Keep the current navy/gold visual identity, but reduce nested borders and large empty panel padding. Make the active target, cast warning, and companion state dominate decorative framing.
- Preserve form focus during profile refreshes. `refreshProfile()` rebuilds the collection panel; `renderPanel()` only restores focus using `data-action`, while move selectors use `data-learn-creature`/`data-learn-slot`. A background profile update can replace the control being edited. Reuse `updateMarkup` or targeted field updates and stable control IDs.
- Add secure guest recovery/account linking before asking testers to invest substantial progression. The current localStorage-only identity cannot be recovered through the UI on another browser. This is a documented product limitation, not a demonstrated token theft.
- Keep mobile support explicit: the current small-screen guidance is useful, but this audit did not establish a touch-playable game.

All eight existing regional tour images were inspected. These fixture views intentionally contain no networked Pokémon, so their emptiness does not prove absent wild spawns. They do expose landscape composition: repeated circular ponds, evenly scattered ground props, similar waystone/stall/bench arrangements, and sharp terrain-color transitions. Use fewer filler props and spend that rendering budget on authored places.

| Region              | Concrete next pass using the existing assets                                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hearthwick          | Turn the broad plaza edges into gardens, courtyards, and service areas; add purposeful NPC routes between market, healing, and expedition board. Blend the abrupt forest boundary behind town. |
| Sunpetal Meadows    | Build readable field/orchard boundaries and paths to the windmill. Cluster flowers around soil and water instead of uniform scatter; add feeding/drinking moments at those sites.              |
| Lanternwood         | Repair the thin, partly occluded waterfall and its rock contact. Give the forest a canopy route, a clearing, and a distinct understory; reduce conspicuous rings of shore trees.               |
| Tideglass Reach     | Compose connected ruin footprints with fallen sections and an approach route. Reconcile the smooth cliff material with the blockwork assets and give water a broken stone shoreline.           |
| Amberfall Expanse   | Break the round oasis bowl into varied banks and a dry wash; anchor the expedition camp to shade and water. Let dunes guide the player toward bones and ruins.                                 |
| Moonfen             | Replace the sequence of similar ponds with a readable wetland layout: reed channels, banks, islands, and continuous raised-boardwalk sections. Make safe travel visually obvious.              |
| Frostveil Highlands | Add snowdrift shapes, rock outcrops, and darker focal points so the white scene reads clearly. Make the approach to the frozen lake and camp legible.                                          |
| Kingsward Vale      | Give the watchtower a connected settlement/field edge and a recognizable route. Replace isolated benches and stalls with small coherent activity areas.                                        |

Reuse `LAKES`, `LANDMARKS`, `roadDistance`, `terrainHeight`, scenery placement, existing thin instances, and region audio. Extend shared collision proxies alongside substantial new rocks, walls, and walkable structures so presentation and movement agree. Do not replace the world with an unrelated finished map that breaks the authored quests and coordinates.

## Code reuse, cleanup, and operational review

- Strict unused-local/parameter checking passed. That does not detect unused exported APIs, unreachable branches, or obsolete CSS. The old `KeyH` hello-emote branch in `main.ts`, line 1464, is unreachable in normal class-selected gameplay because the earlier companion-follow handler returns first. Remove or assign it deliberately.
- Reuse existing `DuelSystem`, companion modules, shared rules, `safeSend`, transaction receipts, model library, effect pool, and `updateMarkup`. Extract focused helpers for effective combat level, duel participant cleanup, profile merge-by-ID, and HTTP error mapping.
- `room.ts` combines admission, persistence, commands, snapshots, and simulation; `main.ts` combines networking and panel/controller logic. Split these along the existing modules when fixing the corresponding behavior. Avoid a broad rewrite that duplicates combat or persistence paths.
- The 2,820-line base stylesheet and 1,368-line interface stylesheet layer overlapping UI concerns. Consolidate HUD/component rules with screenshot checks; do not delete selectors solely because they are absent on the title screen.
- TypeScript's current project excludes `scripts/`; add a separate check for the operational/test scripts. No repository CI workflow was found. Heroku's postbuild checks types and builds, but does not run the integration/browser suite.
- Migrations run both in the release process and application startup, and replay DDL rather than advance distinct migration versions. Move toward versioned changes with release-time migration once deployment needs warrant it.
- Read-only Heroku checks confirmed one Basic web dyno running and a daily database backup schedule at 03:00 Europe/Ljubljana. A restore drill was not performed. Keep this single-process topology until session ownership and routing support multiple processes; simply adding web dynos would invalidate the process-local session guarantees.
- Asset verification checked all 273 manifest entries against file existence, sizes, and hashes: no mismatches. Source and license metadata are present; Pokémon entries are explicitly marked rights-reserved, distinct from the CC0 scenery. Hash verification does not independently establish redistribution permission.

## Validation and limits

- `npm test`: 128 tests passed across 20 files.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: passed.
- `npm run build`: passed in 74 seconds; the existing oversized Babylon/client chunk warning remains.
- `npx prettier --check .`: passed; the report and local reproduction sources were also formatted directly with Prettier.
- `npm audit --omit=dev` and full `npm audit`: zero reported production or development dependency vulnerabilities. This does not cover application logic or prove absence of vulnerabilities.
- `npm run test:network`: all 10 checks passed, including command rejection, durable economy, duel consent, and reconnect persistence.
- Full local Chromium browser suite against the locally served production build: all 23 tests passed in 6 minutes, including death/reconnect/heal, two-browser duels, capture/evolution, model failure handling, input, effects, and responsive layouts. Log: `evidence/audit-browser.log`.
- Two isolated fault-injection assertions reproduced the duel defects; these assert current bad behavior and are not shipped regression tests.
- An isolated PostgreSQL connection-loss reproduction exited with the expected unhandled-error failure.
- Prior same-day rendering/load evidence was reviewed, not rerun. The renderer fixture is a reference-Mac measurement, not proof of mobile or 16-rendered-player performance.

No production failure injection, penetration-test load, database restore, cross-browser/mobile performance test, or long-duration soak was performed. The recommended order is admission/error recovery, duel correctness, database/network efficiency, then a measured HUD and authored-region pass.
