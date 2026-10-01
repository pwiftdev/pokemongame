# Adventure improvements

This pass develops the existing adventure, quest, companion and multiplayer systems. Changes remain local; no commit or Heroku release was made.

## Player-facing changes

- The quest tracker explains the current chapter, gives compass directions and lets a new explorer collect the first allowance directly. The journal keeps the main story visible and groups side expeditions in an expandable section.
- Companions react to a greeting and use their species temperament for occasional resting animations. Movement, combat and fainting take priority. Existing model animations and multiplayer emotes provide the reactions.
- Combat guidance explains range and obstructed attacks, warns about a selected enemy's incoming attack, and explains capture preparation, distance, missing capsules and sleeping Pokémon.
- Eight regional field studies unlock after the story capture chapter. Each asks for two different species caught in that region after acceptance. Studies reward 70 PD and 140 companion XP through the existing quest system. The map shows accepted study progress, habitat advice, daylight and weather.
- Team cards show the next learned move and evolution requirements using the actual Pokémon data.
- Clicking the online explorer count opens an island roster with location, distance, health and companion information. Explorers appear on the minimap and world map. Invitation links select the island before onboarding; they never include a guest identity. A selectable link remains available when clipboard access fails.
- Settings includes optional frame-rate, frame-time, draw-call and connection-update diagnostics.

## Performance work

- Static catalog lookups use cached arrays and indexes.
- Minimap terrain and roads are drawn once into an atlas; subsequent updates draw a crop and moving markers. World-map terrain markup is cached.
- Creature animation clips are indexed, and settled looping animations avoid repeated blend-weight writes.
- An enabled-mesh candidate cache excludes disabled scenery from Babylon's per-frame scan. It tracks inherited enable changes, reparenting, late additions, removals and disposal. Babylon still performs normal readiness and visibility checks on candidates.
- The benchmark uses fresh, separate 30-second animation-frame samples for each quality setting after a warm-up. It no longer mixes samples from the previous quality setting.

## Code audit

- Reused existing quest acceptance, unique-objective stamps, reward claims, capture transactions, animations, room snapshots and emotes. No new database table, public endpoint, recovery protocol or lease state machine.
- Research progress is part of the successful capture transaction, using the region sampled when the capture starts. Failed captures do not count. Duplicate species and repeat claims are rejected by existing shared quest rules.
- Tests cover a failed socket after capture commit and reconciliation of a stale world without duplicate research progress.
- Invitation input accepts only a bounded island code. Names and labels are escaped before HTML rendering. Clipboard denial exposes the invitation as selectable text. Identity tokens are never included in shared links.
- Diagnostics run only while their settings section is open. The roster refreshes once per second while visible. Existing snapshot traffic is reused.
- Checked cached catalog callers for in-place mutation. Strict TypeScript checks include unused locals and parameters. New helpers keep rendering and UI logic out of the main controller where practical.
- Renderer tests cover disabled parents, reparenting, fresh meshes, removal/re-addition, disposal before delayed creation notifications, provider cleanup, animation transitions, one-shot completion and preference for original clips over duplicate fallback names.

## Scope still remaining

This is an initial pass across the seven improvement areas. It does not add formal parties, accounts, a new reconnect protocol, repeatable regional events, or a fully authored first-15-minute campaign. Regional studies add goals to the existing habitats; they do not replace their encounter layouts. Rendering performance still needs measurement on lower-end hardware and larger multiplayer scenes.

## Validation

- 214 unit and integration tests passed. The final clip-precedence regression also passed after the audit adjustment.
- 16 distinct browser flows passed across the main run and targeted reruns: new guidance and greetings, invitations and clipboard denial, character editing and resume, creator layout and starter selection, two combat classes, two-player duels, story navigation, capture/evolution/Pokédex, loading recovery, missing identity, menus, title layout and HUD layout.
- The initial HUD check exposed an overlap at 1280×720. The corrected layout passed all seven viewport/scale combinations from 800×600 through 1920×1080, including 125% interface scaling. Secondary tracker guidance stays in the journal when the HUD has limited vertical space.
- Production build, strict TypeScript unused-code checks and direct Prettier checks passed.
- Evidence is retained locally under `evidence/journey-*`; screenshots include `journey-explorers.png`, `journey-performance-panel.png` and the `ui-layout-*` images.

## Local rendering measurement

Chromium on an Apple M4 with 16 GB RAM, 1440×900, deterministic production-island scene containing 30 animated Pokémon. Each quality setting uses a five-second warm-up followed by a fresh 30-second sample. No other browser tests ran during the measurements.

| Quality | Before average FPS | After average FPS | Before / after median frame | Before / after 95th-percentile frame |
| ------- | -----------------: | ----------------: | --------------------------- | ------------------------------------ |
| High    |               10.9 |              56.1 | 100.0 / 16.7 ms             | 100.1 / 16.8 ms                      |
| Low     |               23.7 |              60.0 | 16.7 / 16.7 ms              | 100.0 / 16.7 ms                      |

Both runs loaded and displayed all 30 Pokémon without browser errors. Draw calls stayed at 452 on High and 426 on Low; the scene still contained 6,147 meshes. Screenshots were reviewed for missing models and scenery.

These are observations from one local before/after pair, not a guaranteed speedup. Shader warm-up, caches and OS load can influence timing. The changes remove repeated CPU work; this comparison does not isolate the contribution of each optimization. This fixture also does not measure multiplayer server capacity. Raw results: `evidence/journey-baseline-fresh.json` and `evidence/journey-render-final.json`.
