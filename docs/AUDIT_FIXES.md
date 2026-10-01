# Audit fixes — 30 September 2026

This first repair pass addresses admission, failure recovery, duel fairness, asset loading, and unnecessary profile/database work. It builds on the existing working tree without creating a Git commit.

## Changes

- Authenticate before allocating a Colyseus world. Check origins and request size outside framework routing. Limit matchmaking to 60 attempts per trusted client IP per minute, 12 authenticated joins per identity per minute, three explicit creates per identity per minute, and eight rooms per process. Bound limiter storage without evicting live counters. These are abuse controls, not a guarantee against distributed denial of service.
- Handle idle PostgreSQL connection errors and bound connection, statement, lock, and idle-transaction waits. Discard failed transaction connections. Preserve receipt reconciliation after ambiguous commits.
- Return both updated profiles with the committed match result. Clear both duel participants before attempting result delivery, without another profile query. Check duel ownership before modifying a replacement player session. Repeated completion cannot grant another reward.
- Apply the shared level-10 rule to duel resources, ability unlocks, snapshots, action bars, and tooltips. Keep progression unchanged and describe the actual trainer-only arena behavior.
- Allow failed nature, animal, and regional scenery files to load later. Keep required village/hero models guarded. Share bounded Pokémon/scenery retries through the existing library, cancel retry timers on disposal, and include late scenery in shadows, camera collision, and culling.
- Return 404 for missing assets/API routes, 400 for malformed input, 413 for oversized requests, and safe service errors for unexpected failures.
- Avoid extra session/profile reads and duplicate duel reward-count queries. Use maintained leaderboard counters and supporting indexes. Merge runtime creature health through one map. Suppress redundant profile messages for no-op combat mutations while retaining durable receipts and health/replay reconciliation.
- Preserve open move details and focused selectors across profile updates. Remove the unreachable H-key emote branch. Measure simulation queue wait separately from tick execution.

## Audit and boundaries

The review covered unused imports/locals, helper reuse, transaction/replay behavior, session replacement, origin/proxy handling, bounded request memory, query duplication, asset disposal, and late geometry registration. It reuses the existing mutation receipts, rate limiter, model cache, safe message delivery, shared class rules, and markup cache.

The database still shares the simulation queue, and transient commands still write receipts. Bounded waits reduce worst-case exposure but do not make the simulation independent of database latency. Delta snapshots, receipt retention, regional streaming/cache eviction, compact HUD composition, and authored biome improvements remain open. Optional assets have a bounded retry window; a prolonged outage can still require reload. Required startup models remain mandatory.

## Validation

- All 161 unit/database tests passed across 25 files. Failure cases include idle/active connection loss, unavailable database, pool exhaustion, query timeout, rollback after a profile write, ambiguous commits, player replacement, and failed result delivery. Asset tests cover shared downloads, required-file cleanup, retry limits, timer cancellation, and disposal during a download.
- All 26 browser cases passed across the full run and a targeted rerun of three corrected asset tests. The first run passed 23 cases; its three failures came from a full browser resource-timing buffer hiding successful retries. Network traces confirmed the downloads, and the corrected response-based assertions passed for nature, animals, and regional props. Coverage includes two-player duels, defeat/reconnect/healing, capture/evolution, controls, responsive layout, and preserving the move editor during real profile messages.
- All 10 network checks and 12 combat-system checks passed.
- Strict TypeScript checks, including unused locals/parameters, passed. Production client build passed; the existing large Babylon chunk warning remains.

Raw logs are under the ignored `evidence/fixes-*` paths. Browser tests use the locally served production build; database fault tests use owned connections or isolated schemas. Performance measurements on the local Apple M4/16 GB machine:

- 16 simulated clients in one room for 60 seconds: passed, 9.83–10.02 snapshots/sec per client; p95 tick execution 5.88 ms and p95 queue wait 0.052 ms. Received application JSON totaled 144.74 MB. This is not rendered multiplayer FPS, and snapshot bandwidth remains an open optimization.
- 30 real Pokémon models at 1440×900: about 60 FPS in both high and low modes, p95 frame time 17.5 ms, 452/426 draw calls, no browser errors. Startup took 2.87 seconds. This is a reference-Mac fixture, not proof of weak-device performance or an FPS gain from these repairs.

The Heroku deployment retains one Basic web dyno and the existing essential-0 database. No Git commit is created.

## Deployment

Deployed the working tree as Heroku release **v12**, source label `audit-fixes-20260930`, on 30 September 2026. The release migration and production build succeeded. [Live game](https://pokemon-dollars-play-7ffdf663f528.herokuapp.com/).

Live checks passed for the homepage, database health, missing asset/API responses, rejection of invalid room credentials, and origin rejection. Two independent browser contexts then joined the live game and completed a normalized trainer duel successfully. Production was not load-tested or subjected to database failure injection. The existing Basic dyno and database plan were retained; Git HEAD remains `30059a6` with no new commit.
