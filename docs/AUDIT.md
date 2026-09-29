# Release code audit

Executed against the assembled implementation, with fixes verified by type checking, database tests, real network clients, and browser interaction. Evidence files record actual test results separately from intended behavior.

## Architecture and reuse

Shared species/items/quests/abilities/locations and pure rules are used by both client and server. Renderer and audio are outside UI state. Server-only database/authentication/reward modules are not imported by the browser. Reused gameplay helpers handle active ownership, consuming supplies, purchases, experience, quest claims, safe delivery, place checks, and peace checks. Duel handling and boss targeting were extracted from the room controller. SQL views reuse the canonical persisted match/ledger records.

`tsc --noEmit --noUnusedLocals --noUnusedParameters` was run to check unused symbols and imports. No unused-symbol errors remained. The main room/UI controllers remain larger than ideal, but their domain helpers avoid parallel implementations of the same game rules.

## Security and persistence

- Shared item lookup rejects inherited object keys (`__proto__`, `constructor`, `toString`) with regression coverage.
- Strict command shapes reject extra fields, foreign ownership, non-finite numbers, position injection, unknown reward commands, excessive quantities and invalid nicknames.
- Opaque random session tokens are hashed in PostgreSQL; identity comes from authenticated membership.
- HTTP, matchmaking, and WebSocket upgrades check allowed origins. HTTP/body/message and per-session rate limits are applied.
- Currency/inventory/ownership mutations lock player rows, validate profile invariants, use unique request receipts, and commit atomically. Ledger references and capture IDs add independent uniqueness constraints.
- Ledger edits/deletes are rejected by a trigger. Balance reconciliation is tested. Concurrent purchases and captures, transaction rollback, replay, post-commit delivery failure, and ambiguous COMMIT acknowledgement are tested.
- Match completion uses consistent lock order, canonical result recovery, bounded daily/opponent rewards, and no payout for surrender/disconnect.
- New token sessions fence old connections. Interrupted connections have a bounded grace period and disconnect-forfeit cleanup.
- No wallet, payment, privileged browser reward, free-text chat, or production admin command is present.

## Issues found and fixed

- Older Colyseus transitive compatibility failed after security patches: upgraded server/SDK to the compatible0.18 generation and pinned versions.
- Fixed production static asset directory, initial inventory item key, quest counters, atomic welcome grant, ambiguous commit recovery, and post-commit socket delivery handling.
- Fixed movement handedness, remapped backward key, menu input blocking, focus preservation, camera resets, duel auto-targeting and normalized HUD health.
- Fixed skeletal gallery facing, custom mesh winding/UV merge, path overlap artifacts, decorative spawn occlusion, shadow acne and camera obstruction handling.
- Added readable authoritative boss cast warnings and impact-time validation, always visible in low quality.
- Added 20-victory and 10-capture quest gates after the initial fresh-player run exposed a short story path; prerequisites and repeat claims are covered.
- Verified real browser defeat, town return and free healing, plus persisted defeat/heal regression coverage.
- Corrected camera target updates that unintentionally changed orbit and zoom; added close-camera label/body visibility safeguards with restoration tests. Selected enemies now clear on the player’s defeat.
- Added origin checks before WebSocket upgrades and consistent graceful shutdown ownership.
- Corrected per-asset credits and aligned creature descriptions to actual licensed models.

## Query/performance review

Player mutation queries lock a single indexed primary-key row; match results lock two IDs in stable order. Token hashes, request receipts, capture identity, ledger player/time, and match participants have indexes. Snapshot state is in memory; movement does not issue database queries. Profiling measures server tick times and10Hz snapshots independently from graphical FPS. Renderer batches static environment meshes, shares model templates and limits active actors; quality settings reduce rendering load. Actor disposal clears skeletons/animations, nameplates and shadow-list references.

The deployment remains a single persistent server process with separate16-seat rooms. Distributed session ownership and public account recovery are not claimed. Guest identity loss after clearing browser storage is documented. No source was committed.
