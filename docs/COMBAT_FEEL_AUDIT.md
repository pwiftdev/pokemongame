# Movement, animation and combat presentation review

This pass addresses abrupt animation changes, skating movement, repeated attack poses, generic spells and effects that hide the characters.

## Changes

- Movement prediction now responds directly to input, stops on release and applies the same slow/stun multipliers as the server. Camera follow is quicker, with a closer default view and a small, optional sprint field-of-view change.
- Shared creature-body separation prevents walking into living enemies. Movement can slide along their boundary, retreat from an overlap and pass through defeated enemies. The server still validates movement and combat.
- A shared animation mixer crossfades hero and creature actions over 120ms, normalizes interrupted transitions and holds the final frame of one-shot clips. Hero locomotion has an independent lower-body layer, so attacking while moving does not freeze the legs.
- KayKit characters retain 13–15 authored clips each, including distinct running, jumping, landing and class attacks. Repeated weapon attacks alternate clips; shield strike, healing, protection and mage spells select appropriate motions. The source clip list also drives asset preparation and integrity tests.
- Holding 1 repeats the primary attack. A press within the final 220ms of a cooldown can be queued; it expires quickly and is cancelled by target changes, menus or disconnection. Attacks and effects still require server acceptance.
- Sword and axe strikes use tapered slash ribbons. Firebolt has a luminous trail; Frost Nova erupts into crystals; Meteor falls from above as a shaded rock with animated flame and produces a larger impact. The flame shader is shared with the existing world torches. Barriers use a lit rim, and status effects use small wisps. Damage numbers and ground warnings are smaller.
- Impact sound, hit flash, camera feedback and hit reactions use the visual impact callback. Enemy defeat poses wait for the finishing attack's visual impact. Footsteps follow actual ground travel, rather than key presses against walls or while airborne.
- Lighting uses ACES tone mapping with adjusted exposure and fill. Ground texture contrast is reduced. Grass batches now have independent geometry: previously shared instance buffers caused batches to draw with another cell's transforms. Ground cover is denser, with fewer flower clumps relative to grass.

## Code audit

- Reused the existing authoritative attack, cooldown, inventory, targeting, persistence and movement validation paths. No new endpoint, dependency, database schema, lease or recovery state machine was added.
- Extracted animation mixing, combat timing, effect materials, effect lifetime and combat primitives into focused helpers. Hero clip definitions are shared with the asset preparation script rather than maintained in two separate lists.
- Checked unused imports and locals with TypeScript, duplication, error handling, resource disposal and rendering cost. Timed effects have a fixed count limit, release private textures/materials, and clean up even during delayed windup. Animation observers and cloned lower-body groups are released with their actors.
- New collision calculations run against the server's own live creatures. Client-side prediction cannot authorize damage, rewards, capture or travel. Existing ownership, rate limit, command validation and transaction boundaries remain in force.
- Reduced-motion mode suppresses camera shake and sprint FOV changes and attenuates particles. Low-quality mode still disables dense grass and bloom. The new foliage material copies are limited and disposed with the scenery.
- The asset manifest contains updated hashes and byte counts for the expanded animation files. Their original KayKit CC0 provenance remains recorded. Pokémon provenance is unchanged.

## Validation

TypeScript with unused checks, 63 unit tests, the production build and Prettier pass. The server gameplay checks for classes, independent companion attacks, travel and persistence pass, as does the guard/dodge timing test.

All 17 browser scenarios pass across the production run and targeted reruns; the final held-attack check passed twice consecutively. `evidence/feel-validation-summary.json` records the combined result with links to the raw runs. The final recorded spell scene measured 58.5 FPS, a 19.4ms 95th-percentile frame time and 212 draw calls at 1440×900 in local Chromium/Metal, with no browser errors. This is a local measurement, not a device-wide performance guarantee.

A short silent gameplay recording is available at `evidence/combat-feel-preview.mp4`.

Current results are recorded in `evidence/browser-results.json`, the `feel-*` screenshots and browser recordings, and `evidence/rpg-gameplay.json`. Unit coverage includes animation crossfades and interruption, one-shot restart and cleanup, shared collision behavior, movement impairment expiry, class clip availability, impact timing, delayed effects and resource limits. Browser coverage exercises movement, jumps, held melee attacks and distinct frost/meteor effects alongside the existing camera, multiplayer, onboarding and asset-failure checks.

The model-inspection assertion was updated to wait for crossfades instead of expecting outgoing clips to stop immediately. The melee test now observes the next swing concurrently with movement and chooses an open sidestep: its original route could correctly be blocked by the enemy body, causing the test to miss the short pose while waiting. These failures and targeted verification runs are retained in the evidence reports.

## Remaining limits

The game still uses the supplied stylized packs. This is a substantial presentation and control pass, not a replacement with bespoke studio art. Hero damage and rewards remain resolved by the server on accepted commands; the short presentation windup does not introduce a new server casting system. Jumping is local visual movement rather than synchronized vertical physics. Five Pokémon still use the existing procedural skeletal motion. Generated combat audio is synthesized rather than recorded Foley. These are separate areas for further production work.
