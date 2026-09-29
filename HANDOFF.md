# Handoff

The game is built and running locally. Source, packaged assets, migrations, tests, and operating instructions are in this workspace. No commits were made.

## Play and run

- Verified production preview: http://localhost:2567 (`npm start`).
- Development client: http://localhost:5173 (`npm run dev:client`).
- PostgreSQL database: `pokemon_dollars`, using the existing local service.
- Start from a clean checkout with the commands in README.md. The browser stores a secret guest identity; keep browser storage to retain access.

## Executed checks

- Clean `npm ci`, production build, TypeScript and unused-symbol audit, 38 unit/database/camera tests, Prettier, and `npm audit` with zero vulnerabilities.
- Five production browser tests: two independent players complete a duel with matching persisted results; onboarding, menus, settings and resume; missing-guest and asset-load recovery; desktop aspect ratios.
- Two ten-minute, 16-client network load runs. Latest: 600.054 seconds, approximately 9.72 snapshots/second, mean server tick 0.255 ms, p95 0.886 ms, max 22.177 ms.
- All 12 species captured, evolution, main quest chain and cooperative boss rewards tested against a real server with explicitly leveled fixtures.
- Added 150 ms round-trip latency, three SIGKILL restart boundaries, duplicate-session fencing, brief reconnect and disconnect-forfeit checks passed.
- Actual Apple M4 Metal at 1920×1080: about 60 FPS high/low; p95 frame time about 18.3 ms. One rendered player and 22 wild creatures. Complete local transfer about 12.9 MB; short-run JavaScript heap about 121 MB. This is not a claim about 16 rendered players or hours-long memory stability.
- A normal level 1 browser player bought supplies, battled, tamed and visited all biomes. Thirteen final screenshots, gameplay videos and zero page errors. The browser also verified actual defeat, return to town, and free healing. Forest camera clipping was found and fixed; the corrected view and live boss warning were inspected.

## Progression and limits

The complete expanded story passed 11/11 checks with two fresh accounts and ordinary starting resources. Each earned 22 victories, made 10 captures, ascended a starter, defeated an elite and Stormheart, and claimed all 13 required story quests. Final starters were level 14. Ledger sources minus spending matched balances of 1,419 and 1,659 PD, and reconnect preserved both profiles. No profile, supply or currency fixtures were used. Evidence: `evidence/first-session-test.json`. The optimized automated route took 9.91 minutes; this is separate from human pacing.

The analytical economy model estimates roughly 53 minutes for an exploratory first session under explicit reading/travel assumptions. It is not a measured first-time human playtest; optimized automated cooperation is substantially faster. Human pacing and usability feedback remain unverified. This is the remaining external acceptance check: record unassisted first-time players’ completion times and confusing steps, then tune objectives if necessary.

Public hosting was not requested or performed. A reachable persistent backend, TLS and durable PostgreSQL are required for public multiplayer; deployment, origins, routing and backup instructions are in docs/DEPLOYMENT.md. Public account recovery is not implemented. Decorative scenery uses camera collision but not additional authoritative movement collision. Animation clips transition immediately rather than through full crossfades.

## Verification commands

```sh
npm run typecheck
npm test
npm run build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:2567 npm run test:e2e
npm run test:visual
npm run test:render
npm run test:network
npm run test:connectivity
npm run test:rooms
npm run test:restart
npm run test:gameplay
npm run test:first-session
npm run test:economy
npm run test:load
npx prettier --check .
```

See ACCEPTANCE.md for the evidence matrix and docs/AUDIT.md for the code audit. The original build brief is preserved.
