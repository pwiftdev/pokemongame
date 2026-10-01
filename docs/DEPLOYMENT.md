# Hosting and operations

Run one persistent Node process with one PostgreSQL database and serve dist/client through it. Colyseus creates additional 16-seat island rooms as existing rooms fill. Each room has its own transient encounters. Player collection, economy, quests, and match history are database-owned. Multi-process room hosting is not verified; it requires distributed presence/session fencing and room routing before deployment.

The Heroku testing app is `pokemon-dollars-play` in the EU region. Its URL is https://pokemon-dollars-play-7ffdf663f528.herokuapp.com. Durable guest tokens have no account recovery or revocation UI; saved progress belongs to the browser that created it.

## Heroku multiplayer testing

The budget is one Basic web dyno ($7/month) and one Essential-0 Postgres database ($5/month), approximately $12/month before tax at continuous usage. There are no worker dynos, Redis services or paid monitoring add-ons. [Dyno pricing](https://devcenter.heroku.com/articles/dyno-sizes) and [database pricing](https://www.heroku.com/pricing/) were checked on September 29, 2026.

Keep exactly one web dyno. Rooms currently use in-process state and support 16 players each. Additional rooms run in the same process; this is not a tested multi-server deployment.

To test with a friend, choose **Create a fresh island**, enter the game and copy the island code from the HUD. The second browser chooses **Join a friend's island** and enters that code. Use separate browsers, devices or browser profiles for separate players: the same saved guest token replaces its earlier connection.

The Node.js 24 build installs from `package-lock.json`, checks TypeScript and builds the client. `tsx` is a runtime dependency because the web process runs TypeScript. The Procfile runs the existing database migration during the release phase before starting the web process. The existing startup migration remains idempotent for local development and restarts.

Required Heroku configuration:

- `DATABASE_URL`: managed by the Postgres add-on; do not commit or manually copy its credentials.
- `NODE_ENV=production` and `WEB_CONCURRENCY=1`.
- `PUBLIC_ORIGIN=https://pokemon-dollars-play-7ffdf663f528.herokuapp.com` and the same value for `ALLOWED_ORIGINS`.
- `PGSSLMODE=verify-full` and `NODE_EXTRA_CA_CERTS=/usr/lib/ssl/certs/ca-certificates.crt`. The Essential database uses the AWS RDS certificates included in the Heroku stack. Certificate and hostname verification stay enabled. See [Heroku Postgres TLS](https://devcenter.heroku.com/articles/connecting-heroku-postgres).
- Leave `VITE_SERVER_URL` unset so HTTPS and WebSockets use the deployed origin.

Heroku terminates HTTPS. The app trusts exactly one proxy hop for client IPs, redirects HTTP to its configured HTTPS origin, sets HSTS and compresses text responses. HTML is revalidated after deployments. `.env`, local evidence and editor configuration are excluded from Git; development artifacts are excluded from the Heroku slug.

The 2026-09-30 Pokémon and interface releases use Heroku’s Sources and Builds APIs to deploy a workspace archive without creating a Git commit. The archive excludes local environment files, evidence, dependencies and build output. Heroku installs dependencies and rebuilds the app before the release phase. See [Build and release using the API](https://devcenter.heroku.com/articles/build-and-release-using-the-api).

## Keeping computers and deployments in sync

A workspace deployment does not upload uncommitted changes to GitHub. A later deployment from another computer can replace those changes if its checkout does not contain them. This happened when release v20 deployed GitHub commit `f6d6aae` without the local gear, class-combat, and mob upgrades from v19.

Before deploying from another computer, first commit and push the combined changes with explicit approval, then pull that same GitHub revision on the other computer. Check `git status --short --branch` and `git log -1 --oneline` on both devices. Back up uncommitted work before pulling overlapping changes; do not discard it or force-push to resolve the mismatch.

For a later release from an explicitly approved commit, deploy and inspect the app:

```sh
git push origin main
git push heroku main
heroku ps --app pokemon-dollars-play
heroku logs --tail --app pokemon-dollars-play
curl https://pokemon-dollars-play-7ffdf663f528.herokuapp.com/api/health
```

Pause or resume the web server:

```sh
heroku ps:scale web=0 --app pokemon-dollars-play
heroku ps:scale web=1:basic --app pokemon-dollars-play
```

Pausing the server stops web-dyno usage charges, but the database continues to cost $5/month. Progress remains in Postgres. Restarts disconnect players and discard transient encounters, so reload and rejoin afterward.

Daily Postgres backups can be scheduled at no additional charge:

```sh
heroku pg:backups:schedule DATABASE_URL --at '03:00 Europe/Ljubljana' --app pokemon-dollars-play
heroku pg:backups:schedules --app pokemon-dollars-play
```

## Configuration

Set `DATABASE_URL`, `PORT` (2567 default), and `ALLOWED_ORIGINS` to exact permitted origins. $WOP conversion and payouts use the `WOP_*` and `SOLANA_RPC_URL` variables in docs/WALLET_AND_WOP.md; keep `WOP_TREASURY_SECRET` in Heroku config vars only. A same-origin production browser uses its own origin; a separately hosted frontend needs VITE_SERVER_URL set at build time. Keep database credentials on the server. No admin/reward command is exposed.

A reverse proxy must terminate TLS and forward all HTTP routes plus WebSocket upgrades to the Node service. Example Nginx location inside your own TLS-enabled server block:

```nginx
location / {
    proxy_pass http://127.0.0.1:2567;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 75s;
}
```

For a self-hosted deployment, use your own certificate and DNS and restrict direct backend access to the proxy. Run as an unprivileged OS account. Install dependencies from the lockfile. Run migration before starting new code, and retain a database snapshot before schema changes.

GET /api/health checks the database. Monitor unsuccessful commands, connection failures, memory, tick durations, database latency, and room occupancy. Use a process supervisor with restart backoff. A server restart discards unfinished transient encounters and invites; committed progress survives. Avoid treating transient rooms as a globally persistent island.

## Backup and restore

Use PostgreSQL's supported pg_dump/pg_restore tools, protect backups as player data, and test restoration into an isolated database. Example commands use the existing DATABASE_URL from your shell; do not paste credentials into logs:

```sh
pg_dump --format=custom --file=pokemon-dollars.dump "$DATABASE_URL"
createdb pokemon_dollars_restore
pg_restore --dbname=pokemon_dollars_restore pokemon-dollars.dump
```

Restore into a separate database first, reconcile cached balances against ledger sums, and verify authenticated sample profiles before switching the server connection. Keep database storage on a persistent volume with regular backups. A static frontend host alone cannot provide multiplayer or persistence.
