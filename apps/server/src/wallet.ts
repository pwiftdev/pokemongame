import { createPublicKey, randomBytes, verify } from "node:crypto";
import { createSignInMessageText } from "@solana/wallet-standard-util";
import { HttpError } from "./errors.js";
import { getBase58Encoder, isAddress } from "@solana/kit";

/** A Solana address is the base58 encoding of a 32-byte ed25519 public key. */
export function validAddress(address: unknown): address is string {
  return typeof address === "string" && isAddress(address);
}

export function verifyWalletSignature(
  address: string,
  message: string,
  signature: Uint8Array,
) {
  if (signature.length !== 64) return false;
  const key = createPublicKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      x: Buffer.from(getBase58Encoder().encode(address)).toString("base64url"),
    },
    format: "jwk",
  });
  return verify(null, Buffer.from(message, "utf8"), key, signature);
}

interface Challenge {
  address: string;
  message: string;
  expires: number;
}
const CHALLENGE_MS = 5 * 60 * 1000;
const challenges = new Map<string, Challenge>();

function sweep(now: number) {
  for (const [nonce, challenge] of challenges)
    if (challenge.expires <= now) challenges.delete(nonce);
}

/** Sign-In With Solana style message; wallets show the domain and nonce. */
export function createChallenge(
  address: string,
  origin: string,
  now = Date.now(),
) {
  sweep(now);
  if (challenges.size > 20000)
    throw new HttpError(503, "Too many sign-in attempts. Please try again.");
  const nonce = randomBytes(16).toString("hex");
  const url = new URL(origin);
  const message = createSignInMessageText({
    domain: url.host,
    address,
    statement:
      "Sign in to World of Pokemon. This proves wallet ownership only. No transaction or fee is requested.",
    uri: url.origin,
    version: "1",
    chainId: "solana:mainnet",
    nonce,
    issuedAt: new Date(now).toISOString(),
    expirationTime: new Date(now + CHALLENGE_MS).toISOString(),
  });
  challenges.set(nonce, { address, message, expires: now + CHALLENGE_MS });
  return { nonce, message };
}

/** Verify and consume a challenge. Each nonce can be used once. */
export function redeemChallenge(
  address: string,
  nonce: string,
  signature: string,
  now = Date.now(),
) {
  const challenge = challenges.get(nonce);
  challenges.delete(nonce);
  if (!challenge || challenge.expires <= now || challenge.address !== address)
    throw new HttpError(401, "Sign-in request expired. Please try again.");
  const bytes = Buffer.from(signature, "base64");
  if (!verifyWalletSignature(address, challenge.message, bytes))
    throw new HttpError(401, "Wallet signature could not be verified.");
}
