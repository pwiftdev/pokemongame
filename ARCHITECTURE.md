# Architecture

One TypeScript codebase contains a Babylon browser client, a Colyseus room server, and shared pure data/rules. PostgreSQL holds durable player profiles, request receipts, append-only PD transactions, capture uniqueness, and match history. There are no wallet libraries or privileged browser reward APIs.

## Boundaries

- `packages/shared/data.ts`: branding, elements, species, abilities, shop, places, world bounds and collision proxies. It re-exports story and encounter definitions.
- `packages/shared/story.ts`: authored assignments, NPCs, unique interaction objectives, shared progress and destination helpers.
- `packages/shared/encounters.ts`: named habitats, explicit spawns, respawn delays and pursuit limits.
- `packages/shared/rules.ts`: collision, line of sight, terrain height, capture probability, level costs, and elemental effectiveness.
- `apps/client/src/world.ts` and `render/`: renderer lifecycle, local movement prediction, server reconciliation, model loading, skeletal animations, terrain, effects, and camera.
- `apps/client/src/main.ts`, `ui/`, `audio.ts`: screens, input focus, command dispatch, persistent guest token, and generated audio. UI observes server profiles and snapshots; it cannot grant rewards.
- `apps/server/src/room.ts`: authenticated membership, fixed-step simulation, movement, command authorization, encounters and duels. `gameplay.ts` shares mutation helpers; `commands.ts` validates exact schemas and limits rates.
- `apps/server/src/db.ts`: database transactions, row locks, request deduplication, immutable ledger, capture uniqueness, match results and views.

## Networking

The server steps movement at 20 Hz and broadcasts compact JSON snapshots through real Colyseus room messages at 10 Hz. Snapshots include everyone in a room; distance-based interest filtering is unnecessary for the tested 16-person island. Movement messages are normalized directional inputs, never trusted positions. The server applies shared collisions and bounds. Browser interpolation smooths remote state; local prediction reconciles to authoritative positions.

A 256-bit random guest token authenticates HTTP and room entry. Only its SHA-256 digest is stored in PostgreSQL. Nicknames and every command are validated. Players cannot supply an authenticated player ID. One current connection per account is enforced by server membership; a newer token session replaces the previous one. A disconnected duel cannot persist forever. Room state is transient; durable collection and economy survive a process restart.

## Consistency

Every durable command takes a player row lock inside a PostgreSQL transaction, inserts a unique request receipt, applies inventory/creature/quest and ledger changes, validates invariants, and commits. The same request cannot run twice. Balance is cached inside the profile and reconciled against the sum of ledger amounts. A ledger trigger rejects update/delete. Purchases cannot race past a shared balance. Capture uniqueness is a database constraint on encounter ID. A captured creature is stored only on its owner's profile, and team entries are validated for membership/uniqueness.

Completed matches lock both profiles in stable ID order and use a unique match ID. Reward references independently deduplicate quest/encounter/match credits. Story assignments persist acceptance, per-quest objective counts and unique interaction stamps inside the existing profile transaction. Location and prerequisites are checked by the server; supplies and reward XP use the same atomic path. Legacy quest history remains stored but does not skip the new story. PvP rewards require defeat and are capped by daily wins and repeated opponents.

Rooms serialize combat mutations so encounter checks and local outcomes do not interleave. Database failures surface as errors rather than a silent profile reset. Committed currency and inventory remain authoritative after ambiguous delivery; retry uses the same transaction reference. Interrupted encounters and invitations are discarded on process restart, with no uncommitted victory promised.

## Deployment limits

One Node process creates additional rooms at capacity. This is room-based multiplayer, not one global MMO world. Multi-process distributed session ownership, cross-host room routing, public account recovery, and production hosting are outside the verified configuration. The browser bundle can be served by the Node process or separately with an explicitly configured backend origin. See docs/DEPLOYMENT.md.
