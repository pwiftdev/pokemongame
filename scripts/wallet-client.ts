import { generateKeyPairSync, sign } from "node:crypto";
import { getBase58Decoder } from "@solana/kit";
import type { Profile } from "../packages/shared/types.js";
export function createTestWallet() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
  return {
    address: getBase58Decoder().decode(raw),
    sign: (message: string) =>
      sign(null, Buffer.from(message, "utf8"), privateKey).toString("base64"),
  };
}
async function post(base: string, path: string, body: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message);
  return result;
}
export async function createWalletSession(
  base: string,
  nickname?: string,
  guestToken?: string,
) {
  const user = createTestWallet();
  const challenge = await post(base, "/api/wallet/challenge", {
    address: user.address,
  });
  return (await post(base, "/api/wallet/session", {
    address: user.address,
    nonce: challenge.nonce,
    signature: user.sign(challenge.message),
    ...(nickname ? { nickname } : {}),
    ...(guestToken ? { guestToken } : {}),
  })) as { token: string; profile: Profile; linked: boolean };
}
