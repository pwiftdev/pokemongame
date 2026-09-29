# Story and habitat pass

## Changes

The opening story, **The Fading Wards**, has ten connected assignments: an expedition allowance, meeting Rowan, clearing his orchard, recovering a field kit, catching a wild Pokémon, reaching Elara, clearing the root guardians, inspecting two different wards, lighting the Tideglass beacon and defeating the shared Stormheart boss. Four regional surveys unlock after the capture lesson.

The board and two animated field NPCs explain the assignments. Quest acceptance provides limited supplies once. The journal puts the current chapter first and shows the speaker, objective, reward, destination and turn-in location. The HUD, minimap and world marker point to the current step. Ward flames light locally when that player's inspection is saved.

Twenty-one explicit spawns replace 97 scattered spawns. Each belongs to a named camp or Pokémon habitat. Six peaceful Pokémon occupy three nearby habitats, so Bulbasaur, Charmander and Squirtle can all be caught early. Monsters defend small territories; chase limits are 12m, or 18m for the boss. Respawns wait at least 120 seconds for ordinary monsters, 150 for elites, 180 for the boss and 60 for Pokémon, and are postponed while an online player is within 18m of the spawn home.

Rowan's first prepared catch is guaranteed while that assignment is active. It still requires a valid living Pokémon, range, line of sight, a capsule, and either bait or weakening. Later catches retain the existing probabilities and atomic ownership rules.

## Code audit

- Reused the existing profile quest map, serialized room commands, row locks, request receipts, capture uniqueness and append-only ledger. No new database table, endpoint, recovery flow or lease state machine.
- Acceptance, supplies, objectives, reward currency, XP and completion live in existing atomic profile transactions. The server checks prerequisites and proximity; client markers and disabled buttons do not authorize progress.
- Quest progress starts after acceptance. Camp victories use the server's habitat ID; repeated interaction with one ward cannot count as two inscriptions. Collection and old quest history remain intact for existing characters.
- Inspecting unrelated scenery does not write a profile or create a request receipt. Eligible interactions have bounded, predefined objective keys. Unknown quest/place IDs are rejected.
- Story, progress and destination helpers are shared between server, journal, map and minimap. Encounter data has one spawn list rather than procedural region loops. The unused generic quest UI accessor was removed.
- Dialogue and map text use the existing HTML escaping helper. Supply identifiers come from authored data and are checked against the item catalogue in tests.
- Field NPCs stand beside the road with shared collision proxies, preventing character overlap.
- NPCs reuse the loaded KayKit library and animation mixer. Local ward flames reuse the existing flame renderer. Story meshes, materials, textures and render observers are explicitly disposed.
- Checked type safety, unused imports/locals, duplicate logic, location checks, replay behavior, resource disposal and spawn positions against safe camps and roads.

## Validation

Final checks: 75 unit/database tests, seven browser scenarios across the main run and targeted reruns, the fresh-character story walkthrough, nine class/companion/travel checks, live dodge/guard checks, TypeScript with unused-code checks, production build and Prettier. `evidence/story-validation.json` links the exact reports.

The browser combat navigation fixtures were updated for the new camp: they route around the windmill and approach a moving target within sword range before testing attacks. Initial failures and passing reruns remain recorded separately.

Results are recorded in `evidence/story-gameplay.json`, `evidence/story-browser.log`, `evidence/story-build.log` and the story screenshots. The fresh-character network walkthrough covers real movement, named-camp combat, proximity validation, first capture, unique ward interactions, the beacon and reconnect. Its finale checkpoint unlocks the boss assignment; it does not claim to be a recorded boss victory.

A separate server/database integration test drives the boss defeat reward path, replays it, and turns in the final assignment once. It verifies reward/progression wiring rather than a full cooperative boss fight.

Tests cover prerequisite and acceptance checks, correct turn-in locations, one-time supplies and rewards, concurrent claims, rollback and receipt replay, unique ward inspections, legacy save continuity, habitat density, safe spawn locations, starter availability and respawn suppression. Existing database lease and ambiguous-commit tests remain in place.

The live walkthrough caught and corrected an ordering problem: ward guards now have to be cleared before inspection, so necessary fights count toward the active assignment. Browser testing also found an uninitialized blank label texture holding scene readiness; the marker now starts with its final label text.

## Scope

This is one opening story chapter plus four regional surveys. The outer regions have camps and travel objectives, not separate full story campaigns. Ward restoration and journal completion are per player in the shared world. The final boss remains a cooperative encounter.
