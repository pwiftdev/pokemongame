import { createHash, randomBytes, randomUUID } from "node:crypto";
import type pg from "pg";
import { createDatabasePool } from "./database-pool.js";
import { HttpError } from "./errors.js";
import { BRAND } from "../../../packages/shared/data.js";
import { validateProfile, normalizeProfile } from "./profile.js";
import type {
  Profile,
  LedgerEntry,
  MatchEntry,
} from "../../../packages/shared/types.js";
import "dotenv/config";

export const pool = createDatabasePool(
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/pokemon_dollars",
);
export const schema = `
CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS players (id uuid PRIMARY KEY, token_hash text UNIQUE NOT NULL, profile jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS ledger (id uuid PRIMARY KEY, player_id uuid NOT NULL REFERENCES players(id), amount integer NOT NULL, reason text NOT NULL, reference text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(player_id, reference));
CREATE TABLE IF NOT EXISTS requests (player_id uuid NOT NULL REFERENCES players(id), request_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(player_id, request_id));
CREATE TABLE IF NOT EXISTS captures (encounter_id text PRIMARY KEY, player_id uuid NOT NULL REFERENCES players(id), creature_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS matches (id uuid PRIMARY KEY, a uuid NOT NULL REFERENCES players(id), b uuid NOT NULL REFERENCES players(id), winner uuid REFERENCES players(id), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CHECK(a<>b),CHECK(winner IS NULL OR winner=a OR winner=b));
CREATE UNIQUE INDEX IF NOT EXISTS captures_creature ON captures(creature_id);
CREATE INDEX IF NOT EXISTS ledger_player_time ON ledger(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS matches_a ON matches(a);
CREATE INDEX IF NOT EXISTS matches_b ON matches(b);
CREATE INDEX IF NOT EXISTS matches_time ON matches(created_at DESC);
CREATE INDEX IF NOT EXISTS matches_winner_time ON matches(winner, created_at DESC);
CREATE INDEX IF NOT EXISTS players_rank ON players(((profile->>'wins')::int) DESC, ((profile->>'losses')::int), id) WHERE COALESCE((profile->'quests'->>'duels')::int,0)>0;
CREATE OR REPLACE FUNCTION protect_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ledger is append only'; END $$;
DROP TRIGGER IF EXISTS ledger_append_only ON ledger;
CREATE TRIGGER ledger_append_only BEFORE UPDATE OR DELETE ON ledger FOR EACH ROW EXECUTE FUNCTION protect_ledger();
`;
export async function migrate() {
  const client = await pool.connect();
  let failed = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(8716501)");
    await client.query(schema);
    await client.query("COMMIT");
  } catch (error) {
    failed = true;
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release(failed);
  }
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function authenticate(token: unknown): Promise<Profile> {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(401, "Invalid session. Start a new journey.");
  const result = await pool.query(
    "SELECT profile FROM players WHERE token_hash=$1",
    [tokenHash(token)],
  );
  if (!result.rows[0]) throw new HttpError(401, "Session not found.");
  return normalizeProfile(result.rows[0].profile as Profile);
}
export async function session(nickname: string, existing?: string) {
  if (existing)
    return { token: existing, profile: await authenticate(existing) };
  const token = randomBytes(32).toString("hex");
  const profile: Profile = {
    id: randomUUID(),
    nickname,
    balance: 0,
    creatures: [],
    team: [],
    active: null,
    inventory: { capsule: 8, potion: 3 },
    quests: {},
    claimed: [],
    discoveries: [],
    wins: 0,
    losses: 0,
  };
  const client = await pool.connect();
  let failed = false;
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO players(id,token_hash,profile) VALUES($1,$2,$3)",
      [profile.id, tokenHash(token), profile],
    );
    await new Transaction(client).credit(profile, 180, "welcome", "welcome");
    await client.query("UPDATE players SET profile=$2 WHERE id=$1", [
      profile.id,
      profile,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    failed = true;
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release(failed);
  }
  return { token, profile: normalizeProfile(profile) };
}
export class Transaction {
  constructor(readonly client: pg.PoolClient) {}
  async credit(
    profile: Profile,
    amount: number,
    reason: string,
    reference: string,
  ) {
    if (!Number.isSafeInteger(amount)) throw new Error("Invalid amount.");
    const exists = await this.client.query(
      "SELECT 1 FROM ledger WHERE player_id=$1 AND reference=$2",
      [profile.id, reference],
    );
    if (exists.rowCount) return false;
    if (profile.balance + amount < 0)
      throw new Error(`Not enough ${BRAND.currency}.`);
    await this.client.query(
      "INSERT INTO ledger(id,player_id,amount,reason,reference) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), profile.id, amount, reason, reference],
    );
    profile.balance += amount;
    return true;
  }
  async capture(encounter: string, player: string, creature: string) {
    const result = await this.client.query(
      "INSERT INTO captures(encounter_id,player_id,creature_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING encounter_id",
      [encounter, player, creature],
    );
    if (!result.rowCount)
      throw new Error("This creature has already been tamed.");
  }
}
export async function mutate(
  id: string,
  request: string,
  action: (profile: Profile, tx: Transaction) => Promise<unknown> | unknown,
): Promise<{ profile: Profile; applied: boolean }> {
  const client = await pool.connect();
  let failed = false;
  let released = false;
  let commitStarted = false;
  let actionApplied = false;
  try {
    await client.query("BEGIN");
    const row = await client.query(
      "SELECT profile FROM players WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!row.rows[0]) throw new Error("Player not found.");
    const profile: Profile = normalizeProfile(row.rows[0].profile);
    const receipt = await client.query(
      "INSERT INTO requests(player_id,request_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING request_id",
      [id, request],
    );
    if (!receipt.rowCount) {
      commitStarted = true;
      await client.query("COMMIT");
      return { profile, applied: false };
    }
    await action(profile, new Transaction(client));
    validateProfile(profile);
    await client.query("UPDATE players SET profile=$2 WHERE id=$1", [
      id,
      profile,
    ]);
    actionApplied = true;
    commitStarted = true;
    await client.query("COMMIT");
    return { profile, applied: true };
  } catch (error) {
    failed = true;
    await client.query("ROLLBACK").catch(() => {});
    if (commitStarted) {
      client.release(true);
      released = true;
      const receipt = await pool.query(
        "SELECT p.profile FROM players p JOIN requests r ON r.player_id=p.id WHERE p.id=$1 AND r.request_id=$2",
        [id, request],
      );
      if (receipt.rows[0])
        return {
          profile: normalizeProfile(receipt.rows[0].profile),
          applied: actionApplied,
        };
    }
    throw error;
  } finally {
    if (!released) client.release(failed);
  }
}
export async function ledger(id: string): Promise<LedgerEntry[]> {
  const result = await pool.query(
    'SELECT id,amount,reason,created_at AS "createdAt" FROM ledger WHERE player_id=$1 ORDER BY created_at DESC LIMIT 40',
    [id],
  );
  return result.rows;
}
export async function history(id: string): Promise<MatchEntry[]> {
  const result = await pool.query(
    `SELECT m.id,p.profile->>'nickname' AS opponent,CASE WHEN winner IS NULL THEN 'draw' WHEN winner=$1 THEN 'win' ELSE 'loss' END AS result,m.created_at AS "createdAt" FROM matches m JOIN players p ON p.id=CASE WHEN a=$1 THEN b ELSE a END WHERE a=$1 OR b=$1 ORDER BY m.created_at DESC LIMIT 30`,
    [id],
  );
  return result.rows;
}
export async function leaderboard() {
  const result = await pool.query(
    `SELECT profile->>'nickname' AS nickname,(profile->>'wins')::int AS wins,(profile->>'losses')::int AS losses FROM players WHERE COALESCE((profile->'quests'->>'duels')::int,0)>0 ORDER BY wins DESC,losses ASC,id LIMIT 20`,
  );
  return result.rows;
}
async function readMatch(
  id: string,
  client: Pick<pg.PoolClient, "query"> = pool,
) {
  const result = await client.query(
    "SELECT winner,reason,(SELECT jsonb_agg(profile) FROM players WHERE id IN (m.a,m.b)) AS profiles FROM matches m WHERE id=$1",
    [id],
  );
  const row = result.rows[0] as
    | { winner: string | null; reason: string; profiles: Profile[] }
    | undefined;
  if (!row) return undefined;
  return { ...row, profiles: row.profiles.map(normalizeProfile) };
}
export async function recordMatch(
  id: string,
  a: string,
  b: string,
  winner: string | null,
  reason: string,
) {
  const client = await pool.connect();
  let failed = false;
  let released = false;
  let commitStarted = false;
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      "SELECT id,profile FROM players WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
      [[a, b]],
    );
    const insert = await client.query(
      "INSERT INTO matches(id,a,b,winner,reason) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id",
      [id, a, b, winner, reason],
    );
    let reward = false;
    if (insert.rowCount && winner && reason === "defeat") {
      const counts = await client.query(
        `SELECT (SELECT COUNT(*) FROM matches WHERE winner=$1 AND created_at>now()-interval '1 day') AS wins,
        (SELECT COUNT(*) FROM matches WHERE ((a=$2 AND b=$3) OR (a=$3 AND b=$2)) AND created_at>now()-interval '1 day') AS repeats`,
        [winner, a, b],
      );
      reward =
        Number(counts.rows[0].wins) <= 5 && Number(counts.rows[0].repeats) <= 2;
    }
    if (insert.rowCount)
      for (const row of locked.rows) {
        const p = row.profile as Profile;
        if (winner) {
          if (p.id === winner) p.wins++;
          else p.losses++;
        }
        if (reward && winner === p.id)
          await new Transaction(client).credit(
            p,
            30,
            "arena victory",
            `match:${id}`,
          );
        p.quests.duels = (p.quests.duels ?? 0) + 1;
        await client.query("UPDATE players SET profile=$2 WHERE id=$1", [
          p.id,
          p,
        ]);
      }
    const result = await readMatch(id, client);
    if (!result) throw new Error("Match result missing.");
    commitStarted = true;
    await client.query("COMMIT");
    return result;
  } catch (error) {
    failed = true;
    await client.query("ROLLBACK").catch(() => {});
    if (commitStarted) {
      client.release(true);
      released = true;
      const result = await readMatch(id);
      if (result) return result;
    }
    throw error;
  } finally {
    if (!released) client.release(failed);
  }
}
export async function getProfile(id: string): Promise<Profile> {
  return normalizeProfile(
    (await pool.query("SELECT profile FROM players WHERE id=$1", [id])).rows[0]
      .profile,
  );
}

export async function captureOwner(encounter: string): Promise<string | null> {
  const result = await pool.query(
    "SELECT player_id FROM captures WHERE encounter_id=$1",
    [encounter],
  );
  return result.rows[0]?.player_id ?? null;
}
