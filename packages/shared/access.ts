import { regionBiome } from "./regions";
import type { Biome, Profile } from "./types";

/** $WOP, the World of Pokémon token on Solana. */
export const WOP = {
  symbol: "$WOP",
  name: "World of Pokémon",
  /** Whole tokens a wallet must already hold before converting PD. */
  minHolding: 200_000,
};

export const WALLETS = {
  phantom: { name: "Phantom", install: "https://phantom.app/download" },
  solflare: { name: "Solflare", install: "https://solflare.com/download" },
} as const;
export type WalletKind = keyof typeof WALLETS;

/** Regions open to players who continue without a wallet. */
export const GUEST_BIOMES: Biome[] = ["town", "meadow"];
export const GUEST_LIMIT_MESSAGE =
  "Guests can explore Hearthwick and Sunpetal Meadows. Connect a Phantom or Solflare wallet to travel further.";

/** Commands that need a wallet-backed account. */
export const WALLET_COMMANDS = [
  "tame",
  "buy",
  "gearBuy",
  "evolve",
  "dexReward",
  "duel",
  "duelAccept",
  "queue",
] as const;

export const isGuest = (profile: Pick<Profile, "wallet"> | undefined) =>
  !profile?.wallet;

export const guestCanReach = (x: number, z: number) =>
  GUEST_BIOMES.includes(regionBiome(x, z));

/**
 * Limit a guest's step to the guest regions, sliding along the border.
 * A guest already outside (for example, an old save) may move freely.
 */
export function guestStep(
  from: { x: number; z: number },
  next: { x: number; z: number },
) {
  if (guestCanReach(next.x, next.z) || !guestCanReach(from.x, from.z))
    return next;
  if (guestCanReach(next.x, from.z)) return { x: next.x, z: from.z };
  if (guestCanReach(from.x, next.z)) return { x: from.x, z: next.z };
  return { x: from.x, z: from.z };
}

export const shortAddress = (address: string) =>
  `${address.slice(0, 4)}…${address.slice(-4)}`;
