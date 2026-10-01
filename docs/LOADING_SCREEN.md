# Loading screen

The landing page now starts with a responsive loading screen using the shared cheatsheet theme. Only “POKEMON” and a progress bar are visible during normal loading. This markup is included in the HTML, with a small stylesheet and bootstrap module. The large game module loads through a dynamic import after the loader is mounted. The game canvas and interface remain hidden and inert until readiness is confirmed.

Progress comes from actual promises, not a timer or simulated percentage. Five groups cover the engine, world, Pokémon/creatures, adventurers and interface. The progress bar counts prepared work items; the total grows when additional work is discovered. The progress bar exposes the prepared asset count to assistive technology. Embedded GLB textures count with their model. The scene's final work item includes texture/shader readiness and the first rendered frame.

Startup loads all 51 Pokémon models from the existing shared catalog, alongside scenery, wildlife, NPCs and customizable characters. All 70 game portraits, the two external village path textures, shared world emblem and six font faces also load before entry. Existing model templates are reused for gameplay, avoiding placeholder Pokémon on first appearance. Music remains streamed and sound starts under the existing user-interaction rules.

Required startup models use the existing bounded asset retry helper. Missing scenery now blocks entry during startup instead of silently presenting an incomplete island. Failed loads keep the loader open with a short error and a Retry loading button; retry reloads the page without clearing saved identity or settings. A slow connection exposes the same retry option after 25 seconds without pretending that loading has failed. Benchmark, inspection and later in-game loading retain their existing optional model behavior.

## Audit

- Reused the model library, retry helper, shared Pokémon/portrait catalogs, class definitions and Babylon scene readiness. No duplicate model download cache, database endpoint, account mutation or server dependency.
- The tracker is scoped to startup. Later character studio loads do not change startup state or become mandatory scene loads.
- Each asset result is observed; failed parallel loads cannot produce unhandled promise rejections. Existing startup model cleanup remains in place. A world created before an interface failure is disposed, and the reference cleared to avoid disposing it again during unload.
- Failure retains the entry lock; readiness rejects unfinished or failed tasks. The initial game interface is inert and hidden from assistive technology until ready. The title and bar fit narrow screens without scrolling or decorative animation.
- Asset labels use textContent. No third-party asset requests, saved-data deletion or new paid services.
- Progress rendering batches updates into animation frames; no per-asset or group DOM rows are built. No permanent progress timer or observer remains after readiness.
- Checked unused imports, duplicate state, cleanup, error handling, readiness ordering, responsive layout and formatting. No new recovery lease or server state machine.

## Checks

Unit tests cover pending/failed readiness, tracking scope, resetting a discarded startup and listener cleanup. Browser tests hold the engine download, hold the final Pokémon model, abort a portrait and retry, exercise onboarding, and test model failures and recovery. Screenshots cover desktop, tablet and narrow mobile loaders.
