# Pokemon Dollars — The Wildlight Isles

A desktop-browser fantasy RPG on Aster Isle: eight regions, four armed character classes, animated wildlife, hostile monsters and Pokémon companions. Babylon.js renders the island; a Colyseus server owns movement, combat, taming, quests, and currency; PostgreSQL stores progress. PD is exclusively in-game currency.

## Local launch

Requires Node.js 22.12 or newer, npm, and PostgreSQL 14 or newer. This workspace was exercised with Node 26 and a locally running PostgreSQL service.

```sh
npm ci
cp .env.example .env
createdb pokemon_dollars
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:5173 with a desktop keyboard and mouse. Create a guest name, choose a class and Bulbasaur, Charmander or Squirtle, and follow the quest tracker. Open another browser profile or private window for a separate player. Use “Choose an island” to create a fresh room or join a friend’s room code (shown in the HUD). The browser stores a secret guest token; clearing browser storage loses access. Public account recovery is not implemented.

For a PostgreSQL account requiring a password, set `DATABASE_URL` in `.env` to your own connection URI. Never commit credentials. `db:seed` currently applies the idempotent migration; authored species/quests are versioned TypeScript data, and world encounters seed themselves on room creation.

## Verification

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npx tsx scripts/rpg-gameplay-test.ts
npx tsx scripts/rpg-visual-test.ts
npx tsx scripts/combat-timing-test.ts
npm run test:combat-systems
npm run test:network
npm run test:connectivity
npm run test:rooms
npm run test:restart
npm run test:gameplay
npm run test:first-session
npm run test:economy
npm run test:visual
npm run test:render
npm run test:load
npx prettier --check .
```

Browser and network tests expect the local server and Vite to be running. Use `PLAYWRIGHT_BASE_URL=http://127.0.0.1:2567 npm run test:e2e` to verify the production bundle after building. Database tests use isolated temporary schemas in the configured database. `test:gameplay` uses explicitly leveled fixtures for complete roster/encounter coverage; `test:first-session` verifies class creation, hero attacks, independent companion commands, protected waystones and saved progress with ordinary guest accounts. `test:visual` walks the expanded regions with real keyboard input. The default load test runs 16 simulated clients for 600 seconds. `LOAD_SECONDS=30 npm run test:load` is only a smoke test, not the acceptance capacity test. Evidence and limits are listed in ACCEPTANCE.md.

## Production process

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run db:migrate
npm start
```

The Node process serves the production browser bundle and WebSockets on port 2567. Set `PORT`, `DATABASE_URL`, and `ALLOWED_ORIGINS`. If frontend and server use different origins, set `VITE_SERVER_URL` before building. Place a TLS reverse proxy in front of Node. See docs/DEPLOYMENT.md for routing, backups, and hosting limits.

Source is organized into apps/client, apps/server, and packages/shared. See GAME_GUIDE.md for rules, ARCHITECTURE.md for boundaries, and ASSET_MANIFEST.json for asset provenance. No public deployment or blockchain integration is included.

The RPG expansion is documented in docs/RPG_EXPANSION_AUDIT.md. Pokémon assets have separate rights from the CC0 scenery and characters; see THIRD_PARTY_NOTICES.md. No paid assets were purchased.

The latest movement and spell presentation changes, verification and remaining limits are recorded in [the combat-feel audit](docs/COMBAT_FEEL_AUDIT.md).

Combat now follows a tab-target MMO model: class resources (Valor, Mana, Energy with combo points, Rage), a global cooldown, automatic weapon swings, a miss/dodge/parry/block/critical hit table, buffs and debuffs, threat with taunts, and creatures that cast interruptible spells. The HUD adds unit frames, nameplates, floating combat text, a combat log and a richer action bar. See [the combat systems notes](docs/COMBAT_SYSTEMS.md); `npm run test:combat-systems` verifies them against an isolated server.

The opening story is **The Fading Wards**: ten connected chapters, two field NPCs, recoverable supplies, ward inspections and an assisted first Pokémon catch. Encounters use 21 explicit spawns in named habitats instead of procedural region scattering. Run `npm run test:story` for a fresh-character network walkthrough through the beacon and finale unlock.

See [the story and habitat audit](docs/STORY_MODE_AUDIT.md) for the implementation, verification and scope.
