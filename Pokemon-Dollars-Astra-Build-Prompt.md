# Pokemon Dollars — complete autonomous game build prompt

Copy everything below the divider into a fresh Codex task with access to a writable project, terminal, web research, and browser testing. This prompt requests a complete playable first release; it does not guarantee unlimited runtime, hosting, or production-scale capacity.

---

You are the lead game developer, technical artist, multiplayer engineer, game designer, and QA lead for **Pokemon Dollars**. Build the game itself in this workspace. This is an implementation task, not a request for a proposal, a tutorial, a landing page, concept art, or a collection of disconnected demos.

## 1. Product vision and working agreement

Create a beautiful, fully 3D, fully animated, online multiplayer creature-taming adventure. Players explore a shared open world, discover and tame creatures, assemble teams, fight wild creatures and bosses, challenge other players, complete quests, and earn and spend **Pokemon Dollars**, abbreviated **PD**.

The experience should feel like a cohesive new indie game release: inviting, atmospheric, responsive, understandable, and worth exploring. The first five minutes must establish the world, teach the controls naturally, introduce a creature companion, and deliver an enjoyable encounter and meaningful reward.

For this version, PD is exclusively an in-game currency persisted by the game server. A possible future Solana integration is a separate project. Do not connect wallets, mint tokens, implement contracts, collect funds, add cash-outs, imply real-world value, or promise conversion of these balances into future tokens.

Keep the requested working title **Pokemon Dollars** in a central brand configuration. Build an original visual identity and creature roster using assets whose permitted uses have been checked. Do not assume that a publicly downloadable model is licensed for reuse. Use recognizable Pokémon models, logos, music, or other franchise assets only if appropriate permissions are actually supplied; otherwise use original creatures without stopping the project. Make the title, currency label, and creature names easy to change independently of gameplay.

Work autonomously through planning, research, implementation, visual refinement, testing, and handoff. Choose sensible defaults. Do not ask me to select libraries, approve colors, name creatures, choose game rules, or resolve ordinary engineering tradeoffs. Do not stop after scaffolding or a promising screenshot.

Respect workspace instructions, existing user work, platform permissions, and actual tool limits. Do not bypass access restrictions or spend money. Only ask for input when a genuinely necessary credential, unavailable permission, destructive decision, or externally billable action blocks further progress. Continue all independent work first.

You may use parallel specialist agents if available and permitted. Give them isolated ownership of research, assets, world design, backend, UI, and QA tasks. Integrate their work yourself and validate the assembled game. Avoid concurrent edits to the same files.

Maintain a living plan, acceptance checklist, and concise progress log. If context or execution limits interrupt the task, save the exact state, commands, unresolved failures, and next steps in `HANDOFF.md`. Do not pretend you can run indefinitely or resume without another invocation. Within the current session, continue until the release criteria pass or only explicit external blockers remain.

## 2. Platform and technical direction

Default to a desktop-browser game so it is straightforward to launch, share, and test. Use an actual 3D renderer with a controllable camera, world geometry, lighting, collision, skinned creatures, and animation. Menus and HUD may use HTML; the world must be real 3D.

First inspect the repository and runtime. Preserve a suitable existing stack. For an empty project, use this preferred architecture unless a concrete environment constraint makes another approach substantially better:

- TypeScript and Vite for the client build.
- Babylon.js for rendering, scene management, animation, picking, and visual effects.
- A compatible physics/collision approach, with authoritative server movement and collision validation that does not require a browser renderer.
- Node.js and Colyseus for the persistent multiplayer server and room synchronization.
- PostgreSQL for durable player progress, inventory, creature ownership, quests, and PD transactions.
- A small shared package for protocol types, validated commands, game data, and deterministic rules.
- Automated unit/integration tests and browser end-to-end tests, using supported tools such as Vitest and Playwright.
- Simple local orchestration and documented production deployment configuration.

Verify current APIs and compatible versions in official documentation before implementation. Pin dependencies and commit the lockfile. Select one rendering engine and one multiplayer framework; do not build multiple competing implementations.

Keep the renderer outside UI component state. Keep simulation rules independent of visual effects. Never import server secrets, database clients, or privileged reward logic into the browser bundle.

Choose the simplest architecture that satisfies the complete loop. A clear modular server and client are preferable to unnecessary microservices. If PostgreSQL or containers cannot run in the environment, use an explicitly documented durable local database fallback, implement and test migrations for the backend actually used, and identify untested production configurations accurately.

Example organization, adaptable to the repository:

```text
apps/client
apps/server
packages/shared
packages/game-data
assets/source
assets/processed
tests
docs
```

## 3. Complete first-release scope

Build a substantial, finite first release. Do not interpret “open world” as an excuse to generate endless empty terrain or “multiplayer” as a claim of untested MMO scale.

Required content:

- One connected, explorable island with a social town and three distinct wilderness biomes: a sunny meadow, a luminous forest, and a rocky coastal ruin region.
- One recognizable landmark and several encounter or discovery locations per biome.
- A healing station, a usable shop, a quest board, a creature-management location, and a PvP arena.
- At least 12 distinct tameable creature species, with distinct silhouettes and meaningful differences in abilities and behavior; recolors alone do not count as new species.
- Three starter choices drawn from the roster.
- At least six elemental affinities with a simple, documented interaction matrix.
- A team of up to three creatures, one deployed companion, and persistent storage for the rest.
- Creature levels 1–20, experience, learned moves, and at least three visibly distinct evolution or ascension paths with real stat and model changes.
- At least 18 usable combat abilities across the roster.
- At least ten authored quests, including onboarding and a quest chain connecting the biomes.
- At least three repeatable PvE activities, three elite encounter variants, and one cooperative world boss.
- Consensual player-versus-player duels plus an arena queue and persistent results.
- A shop with at least eight useful purchasable items, including taming supplies and healing items.
- A complete first-session progression arc lasting roughly 30–60 minutes, followed by repeatable exploration, combat, collecting, and PvP.
- A target capacity of 16 simultaneous players per world room, with additional rooms when full. Verify this through load testing rather than claiming it from configuration alone.

Do not silently delete required systems to polish the menu. Optional extras come after the required release works. If a requirement cannot be completed, retain it as an explicit failed or blocked acceptance item.

## 4. Visual direction and asset research

Aim for a premium stylized adventure aesthetic: rich greens, warm sunlight, cool shadows, expressive creatures, clear silhouettes, tactile materials, inviting architecture, and cinematic vistas. Prioritize strong composition and coherent art direction over raw polygon count.

Create and follow an art brief covering palette, scale, material roughness, lighting, creature proportions, animation style, UI, and VFX. Assets from different creators must feel like they belong in the same world after material, scale, and lighting adjustments.

Research widely across relevant internet sources. Search intelligently for animated creatures, rigged characters, modular buildings, vegetation, terrain textures, rocks, props, skies, audio, UI icons, and effects. You do not need to crawl the entire internet. Research until every required asset category has a viable, inspected source; then keep building.

Start with these sources and expand as needed:

- https://quaternius.com/ — animated creatures, characters, and stylized environment assets. Inspect the Ultimate Monsters and other animated creature packs.
- https://kenney.nl/assets — consistent environment, interface, prop, and audio resources.
- https://polyhaven.com/ — lighting environments, textures, and selected models that fit the art direction.
- Other creator-owned sites, OpenGameArt, and marketplace listings only where the individual asset's license and downloadable files can be verified.

These are discovery starting points, not blanket permission for every file on a website. Inspect individual licenses, attribution requirements, permitted modifications, and redistribution terms. Prefer free assets that allow the intended game use and distribution. Do not purchase assets or rely on assets that require credentials you do not have.

For each imported asset, record creator, source URL, exact license, acquisition date, local path, required credit, modifications, and checksum in `ASSET_MANIFEST`. Preserve license files and produce in-game credits and `THIRD_PARTY_NOTICES.md`.

Inspect real downloaded files. A search thumbnail, screenshot, preview video, or remote URL is not an integrated game asset. Confirm geometry, UVs, materials, skeleton, animation clips, orientation, dimensions, texture size, and renderer compatibility. Download and package approved runtime assets locally; do not depend on third-party hotlinks during gameplay.

Build an asset inspection scene or contact sheet early. Select a coherent creature family with usable rigs and animations before building twelve incompatible animation controllers. Convert formats with available tooling; optimize geometry and textures; configure required decoders explicitly.

Use well-authored procedural geometry for terrain, paths, certain props, and effects where appropriate. Do not replace every creature with a sphere or leave primitive placeholders in the release. If external downloads are blocked, use available authorized assets and original authored geometry, document the visual limitation, and keep implementing.

Every hero creature needs readable idle, movement, attack, hit, and defeat behavior. Provide tame/summon feedback and celebration where appropriate. Use real skeletal clips or deliberately authored articulated animation. Bobbing a rigid mesh is insufficient for walking and attacking. Flying or swimming creatures may use movement appropriate to their anatomy.

## 5. World and moment-to-moment feel

Build an authored island layout with elevation, paths, clear sightlines, shortcuts, bridges, water, vegetation clusters, small storytelling scenes, and landmarks visible from useful distances. Seeded procedural placement may support authored composition.

Make the spawn vista excellent: a warm town foreground, a nearby creature encounter, a readable path into the first biome, and a distant landmark that suggests future exploration. Give the player a meaningful interaction within the first minute. Avoid huge empty travel distances.

Implement:

- Third-person movement, camera orbit, sprint, and jump where supported by world collision.
- Smooth acceleration and turning, grounded movement, slope handling, and reliable spawn points.
- Camera collision and occlusion handling; prevent the camera from passing through walls.
- Readable interaction prompts, keyboard/mouse controls, remapping, and sensitivity settings.
- A following companion that navigates around obstacles and catches up gracefully without constant visible teleporting.
- Wild creatures with idle, roam, alert, chase, attack, retreat, and respawn behavior as appropriate.
- Traversable navigation data, collision boundaries, and recovery from stuck or fallen states.
- Shared server time for day/night presentation and synchronized timed encounters.
- Animated foliage, water, particles, ambient wildlife, campfires, and biome-specific audio where budgets allow.
- Safe town areas and explicit arena boundaries.

Decorative visual effects may be local. Combat-relevant creature locations, encounter outcomes, collectible availability, and respawn timers must be authoritative and consistent between players.

## 6. Taming and creature progression

Create a complete discovery-to-companion loop:

1. Discover a visible wild creature in the world.
2. Identify its species, level, and behavior without exposing unnecessary hidden combat information.
3. Engage it and weaken it, or use an explicitly supported bait interaction.
4. Use a taming item through a readable aiming or selection interaction.
5. Let the server validate eligibility, distance, inventory, encounter ownership, and timing.
6. Resolve the outcome with server-side randomness and clear animation/audio feedback.
7. Consume supplies and update ownership atomically, preventing double capture.
8. Show a creature summary and allow it to join the team or storage.

The taming probability should depend on species difficulty, remaining health, relevant status effects, and item quality. Keep probabilities bounded and document the formula. Do not make taming success client-controlled.

Persist each individual creature's identity, owner, species, nickname, level, experience, learned abilities, progression state, and any generated traits. Implement team reorder, deploy/recall, storage transfers, healing, and evolution. Prevent the same creature from existing in multiple ownership or active-team slots through concurrent requests.

## 7. Combat, PvE, and cooperative play

Use real-time creature-command combat throughout the shared world and PvP. The trainer moves, selects or locks a target, and issues commands to the active creature. Use four equipped ability slots, cooldowns, readable ranges, a basic attack, and a defensive or evasive action. Keep the trainer's role and targeting rules clear.

Define one coherent combat state machine for wild encounters, trainer battles, duels, and bosses. Implement damage, elemental effectiveness, cooldowns, line of sight, interruption rules, a limited readable set of statuses, defeat, healing, and reward eligibility.

The server decides whether an action is legal and whether it hits. Clients may immediately animate anticipation and predict presentation, but may not decide damage, health, capture, loot, or currency. Use consistent collision proxies and range rules across simulation and rendering.

Combat must feel responsive through anticipation, attack poses, impact flashes, optional restrained camera shake, readable projectiles, ability sounds, health feedback, and defeat transitions. Avoid endless particle noise and effects that hide attacks.

PvE should include approachable early creatures, encounters that teach elemental choices, elites with distinct behaviors, and a boss with at least three readable attacks and two phases. Allow multiple real players to contribute to the boss. Give rewards according to a documented participation rule, once per eligible result. Handle players arriving late, disconnecting, or attempting to claim the same reward repeatedly.

Defeat should have a clear recovery flow and an appropriate setback without destroying a player's collection. Players should never become trapped in combat state after an opponent disappears.

## 8. Real multiplayer and PvP

Implement a real networked server. Two independent browsers must see one another, share the same encounter state, and complete a real duel. Bots can support testing and PvE but must never masquerade as human players.

Implement:

- Session creation, nickname validation, world selection, join, leave, and clear connection states.
- A durable guest identity for low-friction local play, with a clear recovery limitation; add a secure recovery/account path if the game is publicly hosted.
- Server-controlled room membership and player identity; never trust a player ID in a command as authentication.
- Player and companion replication, animation state, emotes, and nearby presence.
- Fixed-step server simulation, measured synchronization rates, client prediction/reconciliation where useful, and interpolation for remote movement.
- Region or distance-based interest management when needed for performance.
- Reconnection with a bounded grace period and recovery of durable state.
- Explicit cleanup for abandoned sessions and prevention of conflicting simultaneous sessions.
- PvP invitations with accept, reject, cancel, timeout, and busy-state handling.
- Arena queue matching between actual available players, including cancellation and disconnect behavior.
- Clear match start, loadout lock, health reset, win/loss, draw/timeout, surrender, and disconnect-forfeit rules.
- Normalized level/stats for the initial PvP mode so progression does not overwhelm fair play.
- Match history and a leaderboard derived from completed server-recorded matches.

Use emotes and preset social messages for the baseline release. Free-text chat is optional and should only ship with appropriate rate limiting, muting/reporting, and moderation support.

Do not claim support for thousands of players or a single global persistent world. Deliver tested rooms and explain the measured capacity and hosting topology.

## 9. Pokemon Dollars economy and persistence

PD must matter to gameplay. Players earn it from quests, verified PvE rewards, discovery milestones, and capped eligible PvP activity. They spend it on taming supplies, consumables, and selected cosmetic or convenience items that do not dominate PvP.

Implement a server-owned append-only transaction ledger with stable transaction IDs, player/account IDs, reason codes, integer amounts, timestamps, and references to the originating quest, encounter, match, or purchase. Decide whether balance is calculated from the ledger or maintained as an atomically updated cached value; test reconciliation.

Reward grants, inventory changes, and balances must be atomic where they form one operation. Enforce uniqueness and idempotency at the database boundary, not only in client UI. Handle simultaneous purchases, repeated network messages, reconnects, retries, and server restarts without duplicated rewards or negative balances.

Include sensible currency sources and sinks, quest rewards, item prices, and progression costs in editable data. Simulate and play through the first hour to ensure players can afford taming and healing without trivial infinite farming. Apply caps and repeated-opponent rules to PvP rewards; do not pay unlimited currency simply for two players repeatedly surrendering.

Provide a clear balance display, item prices, insufficient-funds feedback, purchase confirmation where useful, reward breakdowns, and a recent transaction view.

For future extensibility, isolate currency operations behind a small server-side interface. Do not install a wallet SDK or create blockchain scaffolding that competes with completing the game. Never present this off-chain database as a token balance or a guaranteed future token entitlement.

## 10. Interface, sound, and accessibility

Create a finished interface that matches the world. Include:

- An animated title screen using a real in-engine scene.
- Start/resume, concise onboarding, starter selection, and loading progress based on actual work.
- HUD with active creature, health, abilities, cooldowns, interaction prompts, PD, and tracked quest.
- World map or minimap with discovered places, player location, and quest markers.
- Creature collection, team management, inventory, shop, quest journal, arena UI, match results, and settings.
- Clear empty, loading, full-capacity, disconnected, retry, and error states.
- Credits containing required third-party attribution.

Every visible button must work. Hide unfinished optional features rather than shipping dead controls. Menus must correctly capture focus and release gameplay input. Pause/settings must not imply that opening a menu pauses the shared server world.

Add biome ambience, footsteps, creature voices or fitting vocal effects, ability sounds, UI sounds, and musical loops where appropriately licensed resources are available. Honor browser audio activation rules. Include master/music/effects volume, mute, reduced motion, camera-shake control, readable UI scaling, and cues that do not depend solely on color.

Support common desktop aspect ratios, including 16:9, 16:10, and ultrawide. Desktop keyboard/mouse is the required platform; do not claim mobile or controller support unless fully implemented and tested. Unsupported devices need a clear message rather than a broken layout.

## 11. Performance and reliability

Set budgets before filling the world. Use instancing for repeated vegetation and props, sensible LODs, culling, pooled effects, compressed assets where supported, limited shadow casters, and explicit cleanup of resources, listeners, rooms, and animation controllers.

Aim for 60 FPS at 1080p on a documented representative midrange desktop and a playable low-quality mode. Measure on the hardware actually available. Record actual frame-time distributions, scene complexity, memory behavior, loading size/time, server tick times, and network traffic. A headless software-rendered result is not proof of consumer-GPU performance.

Use progressive world loading and honest progress indicators. Keep the initial playable download small enough for a web game; target roughly 30 MB compressed for the first-play bundle and stream/defer the rest. If the target cannot be met without unacceptable visual loss, record actual measurements and the tradeoff.

Provide quality presets that meaningfully change resolution scaling, shadows, vegetation density, and effects. Maintain gameplay consistency across quality levels. Low settings must not remove combat-critical warnings.

Handle asset loading failures, lost focus, slow networks, reconnects, server unavailability, full rooms, and database errors with recovery or clear user feedback. Never replace failed persistence with a silent reset of the player.

Validate command schemas, authorization, ownership, numeric limits, cooldowns, movement bounds, and inventory requirements. Add rate limits and reject malformed, oversized, replayed, or illegal requests. Keep credentials in environment variables, provide a sanitized `.env.example`, and keep development reward/admin commands disabled in production.

## 12. Execution sequence

Work through these milestones without waiting for approval between them:

1. Inspect the environment and repository; select the supported architecture; create the plan and acceptance matrix.
2. Research and inspect usable assets; establish the art direction and a rendered asset inspection scene.
3. Prove the hard foundation early: two browser clients join one real server, move with collision, see one another, and persist a basic profile through restart.
4. Build one excellent complete loop: explore, encounter, battle, tame, deploy, earn PD, buy an item, reload, and retain the result.
5. Integrate true two-player PvP and test results, payouts, disconnects, and rematches.
6. Expand into the complete island, roster, quests, cooperative boss, progression, and shop content.
7. Finish animation, lighting, environmental detail, VFX, sound, onboarding, and all UI states.
8. Run the acceptance suite, multiplayer stress checks, persistence/restart tests, and visual review. Fix failures and repeat the relevant tests.
9. Package reproducible launch commands, migrations, assets, operational instructions, measured results, and a truthful handoff.

Do not postpone networking until after building a single-player world. Do not treat the first end-to-end loop as final delivery. Do not spend the entire session researching assets or repeatedly rewriting the architecture.

## 13. Required verification and completion gates

Create `ACCEPTANCE.md` with pass, fail, or blocked status and evidence for each requirement. Run real tests. Do not replace acceptance checks with statements of intent.

The release is complete only when the required scope and these checks pass:

**Build and launch**

- A clean dependency install, type check, tests, and production build succeed with documented commands.
- A fresh database can be migrated and seeded, and the game can start without undocumented manual edits.
- The production build loads its actual packaged assets and connects to the configured backend.
- All required models, animations, audio, and decoder resources are present and licensed; no runtime hotlink dependencies or unresolved asset requests remain.

**Gameplay**

- A new player can join, choose a starter, move through each biome, finish onboarding, battle, tame, equip a creature, earn PD, buy an item, and continue progressing.
- All twelve species spawn in intended habitats and can be inspected, battled, and tamed.
- Abilities, level progression, evolution paths, quests, consumables, healing, storage, and map behavior work as described.
- At least two real clients can participate in the boss encounter and receive correctly attributed rewards.

**Multiplayer and adversarial cases**

- Two separate browser contexts with separate identities see each other and complete a duel with the same outcome on both clients.
- Test movement, combat, and reconnect behavior under approximately 100–200 ms added latency and interrupted connectivity using available simulation tools.
- A server restart preserves committed player progress and currency; explicitly define what happens to interrupted uncommitted encounters.
- Concurrent taming attempts cannot both award ownership of the same wild creature.
- Concurrent purchases cannot spend the same balance twice.
- Retrying quest claims, match results, boss rewards, or network commands cannot duplicate rewards.
- Client attempts to set PD, claim another user's creature, teleport beyond legal movement, attack through blocked geometry, or bypass cooldowns are rejected.
- A player disconnecting during a duel cannot trap the opponent or avoid the documented outcome indefinitely.

**Capacity and performance**

- Run a scripted 16-client activity test against a real server for at least ten minutes, including movement and representative gameplay messages.
- Distinguish simulated network clients from rendered browser clients. Record server behavior separately from graphical performance.
- Inspect client performance in populated scenes, track frame times and memory, and address major stutters and leaks.
- Repeat room joins/leaves and major menu transitions to check resource cleanup.

**Visual and interaction review**

- Use browser screenshots and direct interaction to inspect the title screen, spawn vista, every biome, creature close-ups, combat, taming, boss battle, PvP, shop, inventory, and results.
- Capture moving gameplay where available to inspect locomotion, animation blending, camera motion, attack timing, and effects; still images alone cannot validate animation.
- Fix obvious clipping, floating props, T-poses, broken materials, sliding creatures, camera obstruction, unreadable text, HUD overlap, and dead buttons.
- Confirm audio/settings controls, input focus, screen resizing, reduced motion, error recovery, and loading feedback.

Separate evidence that is genuinely executed from inferred behavior. If tools cannot render the game, run a database, simulate a network condition, or host the server, record the limitation, complete all other possible work, and leave that check blocked. Do not claim “fully working,” “production ready,” or “launch ready” while required checks are failed or unverified.

## 14. Delivery and hosting

Deliver the complete source, actual runtime assets, migrations, seed data, tests, lockfile, and configuration in the project. Provide:

- `README.md`: exact prerequisites, install, configure, migrate, seed, run, test, and production-build commands.
- `GAME_GUIDE.md`: controls, taming, progression, economy, PvE, and PvP rules.
- `ARCHITECTURE.md`: client/server responsibilities, persistence, room lifecycle, networking choices, and deployment topology.
- `ASSET_MANIFEST` and `THIRD_PARTY_NOTICES.md`.
- `ACCEPTANCE.md` and test/performance evidence.
- `HANDOFF.md`: current status, any concrete blockers, and exact next actions if incomplete.

Expose a convenient local launch command and leave the runnable preview active if the environment supports it. Public internet multiplayer requires a reachable persistent backend and durable database; a static front-end deployment alone is insufficient. Document TLS, WebSocket routing, allowed origins, health checks, persistent storage, migration handling, backup/restore, and the actual room-hosting approach.

Use an already authorized preview environment when suitable. Do not purchase hosting, publish publicly, or launch a token merely because this task asks you to build a game. If an external deployment needs new permission, prepare the concrete tested build and deployment instructions first, then ask only for the necessary final action.

Finish with a concise report containing how to play, what is complete, the evidence for multiplayer and persistence, measured capacity/performance, and any remaining limitations. Include the live preview URL only if it actually exists and was verified.

The standard is a real, enjoyable multiplayer game with a coherent world, expressive animated creatures, a complete taming and progression loop, fair playable PvP, rewarding PvE, and reliable Pokemon Dollars accounting. Begin implementation now and keep moving through the milestones until the required release is complete or only clearly evidenced external blockers remain.
