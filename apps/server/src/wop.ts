import { randomUUID } from "node:crypto";
import { address, createSolanaRpc } from "@solana/kit";
import { WOP } from "../../../packages/shared/access.js";
import { BRAND } from "../../../packages/shared/data.js";
import type { Profile } from "../../../packages/shared/types.js";
import { mutate, pool } from "./db.js";
import { HttpError } from "./errors.js";
import { validAddress } from "./wallet.js";

export interface WopConfig {
  enabled: boolean;
  mint?: string;
  rpcUrl: string;
  /** $WOP paid per PD, as a decimal string such as "10" or "0.5". */
  rate?: string;
  minHolding: number;
  minPd: number;
  dailyPd: number;
}

export function wopConfig(env = process.env): WopConfig {
  const rate = env.WOP_PER_PD?.trim();
  const mint = env.WOP_MINT?.trim();
  const whole = (value: string | undefined, fallback: number) => {
    const number = Number(value ?? fallback);
    return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
  };
  const validRate =
    !!rate && /^\d+(\.\d{1,9})?$/.test(rate) && Number(rate) > 0;
  return {
    enabled: validAddress(mint) && validRate,
    mint: validAddress(mint) ? mint : undefined,
    rpcUrl: env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    rate: validRate ? rate : undefined,
    minHolding: whole(env.WOP_MIN_HOLDING, WOP.minHolding),
    minPd: Math.max(1, whole(env.WOP_MIN_CONVERT_PD, 100)),
    dailyPd: whole(env.WOP_DAILY_PD_LIMIT, 5000),
  };
}

/** Raw token units for a PD amount: pd × rate × 10^decimals, rounded down. */
export function wopAmount(pd: number, rate: string, decimals: number) {
  const [whole, fraction = ""] = rate.split(".");
  const scaled = BigInt(whole + fraction);
  return (
    (BigInt(pd) * scaled * 10n ** BigInt(decimals)) /
    10n ** BigInt(fraction.length)
  );
}

export function formatUnits(raw: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const fraction = (raw % base).toString().padStart(decimals, "0");
  const trimmed = fraction.replace(/0+$/, "");
  return `${raw / base}${trimmed ? `.${trimmed}` : ""}`;
}

const rpcs = new Map<string, ReturnType<typeof createSolanaRpc>>();
export function solanaRpc(url: string) {
  let rpc = rpcs.get(url);
  if (!rpc) {
    rpc = createSolanaRpc(url);
    rpcs.set(url, rpc);
  }
  return rpc;
}

const decimalsCache = new Map<string, number>();
export async function mintDecimals(config: WopConfig) {
  const cached = decimalsCache.get(config.mint!);
  if (cached !== undefined) return cached;
  const supply = await solanaRpc(config.rpcUrl)
    .getTokenSupply(address(config.mint!))
    .send();
  decimalsCache.set(config.mint!, supply.value.decimals);
  return supply.value.decimals;
}

const holdings = new Map<string, { raw: bigint; at: number }>();
/** Raw $WOP units held by a wallet across all of its token accounts. */
export async function walletHolding(
  config: WopConfig,
  wallet: string,
  maxAgeMs = 30000,
) {
  const cached = holdings.get(wallet);
  if (cached && Date.now() - cached.at < maxAgeMs) return cached.raw;
  const result = await solanaRpc(config.rpcUrl)
    .getTokenAccountsByOwner(
      address(wallet),
      { mint: address(config.mint!) },
      { encoding: "jsonParsed", commitment: "confirmed" },
    )
    .send();
  let raw = 0n;
  for (const account of result.value)
    raw += BigInt(account.account.data.parsed.info.tokenAmount.amount);
  if (holdings.size > 5000) holdings.clear();
  holdings.set(wallet, { raw, at: Date.now() });
  return raw;
}

async function chain<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    console.error("Solana RPC request failed", error);
    throw new HttpError(
      503,
      "The Solana network is not responding. Please try again shortly.",
    );
  }
}

export interface ConversionView {
  id: string;
  pd: number;
  amount: string;
  status: "pending" | "processing" | "sent" | "failed";
  signature: string | null;
  error: string | null;
  createdAt: string;
}

async function conversions(playerId: string, decimals: number) {
  const result = await pool.query(
    `SELECT id,pd,amount::text AS amount,status,signature,error,created_at AS "createdAt" FROM wop_conversions WHERE player_id=$1 ORDER BY created_at DESC LIMIT 20`,
    [playerId],
  );
  return result.rows.map((row) => ({
    ...row,
    amount: formatUnits(BigInt(row.amount), decimals),
  })) as ConversionView[];
}

async function convertedToday(playerId: string) {
  const result = await pool.query(
    "SELECT COALESCE(SUM(pd),0)::int AS total FROM wop_conversions WHERE player_id=$1 AND status<>'failed' AND created_at>now()-interval '1 day'",
    [playerId],
  );
  return Number(result.rows[0].total);
}

/** Everything the $WOP panel shows for one account. */
export async function wopStatus(profile: Profile, config = wopConfig()) {
  const base = {
    enabled: config.enabled,
    mint: config.mint ?? null,
    rate: config.rate ?? null,
    minHolding: config.minHolding,
    minPd: config.minPd,
    dailyPd: config.dailyPd,
    wallet: profile.wallet ?? null,
    balance: profile.balance,
  };
  if (!config.enabled || !profile.wallet)
    return {
      ...base,
      holding: null,
      eligible: false,
      convertedToday: 0,
      conversions: [],
    };
  const decimals = await chain(() => mintDecimals(config));
  const holding = await chain(() => walletHolding(config, profile.wallet!));
  return {
    ...base,
    holding: formatUnits(holding, decimals),
    eligible: holding >= BigInt(config.minHolding) * 10n ** BigInt(decimals),
    convertedToday: await convertedToday(profile.id),
    conversions: await conversions(profile.id, decimals),
  };
}

/**
 * Debit PD and queue a $WOP payout. The wallet must already hold the minimum
 * $WOP. The request ID makes retries safe.
 */
export async function requestConversion(
  profile: Profile,
  pd: number,
  requestId: string,
  config = wopConfig(),
) {
  if (!config.enabled)
    throw new HttpError(403, `${WOP.symbol} conversion is not open yet.`);
  if (!profile.wallet)
    throw new HttpError(403, "Connect a wallet to convert to $WOP.");
  if (!Number.isSafeInteger(pd) || pd < config.minPd)
    throw new HttpError(
      400,
      `Convert at least ${config.minPd} ${BRAND.currency}.`,
    );
  const decimals = await chain(() => mintDecimals(config));
  const holding = await chain(() => walletHolding(config, profile.wallet!, 0));
  if (holding < BigInt(config.minHolding) * 10n ** BigInt(decimals))
    throw new HttpError(
      403,
      `Hold at least ${config.minHolding.toLocaleString("en-US")} ${WOP.symbol} in your wallet to convert.`,
    );
  const amount = wopAmount(pd, config.rate!, decimals);
  if (amount <= 0n) throw new HttpError(400, "That amount is too small.");
  const id = randomUUID();
  const result = await mutate(profile.id, requestId, async (locked, tx) => {
    if (locked.wallet !== profile.wallet)
      throw new HttpError(409, "Your wallet changed. Please sign in again.");
    if (locked.balance < pd)
      throw new HttpError(400, `Not enough ${BRAND.currency}.`);
    const today = await tx.client.query(
      "SELECT COALESCE(SUM(pd),0)::int AS total FROM wop_conversions WHERE player_id=$1 AND status<>'failed' AND created_at>now()-interval '1 day'",
      [locked.id],
    );
    if (Number(today.rows[0].total) + pd > config.dailyPd)
      throw new HttpError(
        429,
        `You can convert up to ${config.dailyPd} ${BRAND.currency} per day.`,
      );
    await tx.credit(locked, -pd, `${WOP.symbol} conversion`, `wop:${id}`);
    await tx.client.query(
      "INSERT INTO wop_conversions(id,player_id,wallet,pd,amount) VALUES($1,$2,$3,$4,$5)",
      [id, locked.id, locked.wallet, pd, amount.toString()],
    );
  });
  return { applied: result.applied, profile: result.profile };
}
