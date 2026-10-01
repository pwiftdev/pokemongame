import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import pg from "pg";
import { getBase58Decoder } from "@solana/kit";

const baseUrl =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/pokemon_dollars";
const admin = new pg.Pool({ connectionString: baseUrl });
const namespace = `test_${randomUUID().replaceAll("-", "")}`;
const testUrl = new URL(baseUrl);
testUrl.searchParams.set("options", `-c search_path=${namespace}`);
process.env.DATABASE_URL = testUrl.toString();
const db = await import("../db.js");
const wallet = await import("../wallet.js");
const wop = await import("../wop.js");

/** A real ed25519 keypair standing in for a Phantom or Solflare wallet. */
function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
  const address = getBase58Decoder().decode(raw);
  return {
    address,
    sign: (message: string) =>
      sign(null, Buffer.from(message, "utf8"), privateKey).toString("base64"),
  };
}

const MINT = "So11111111111111111111111111111111111111112";
let holdings = new Map<string, bigint>();
let rpc: Server;
let rpcUrl = "";
beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${namespace}`);
  await db.migrate();
  rpc = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const call = JSON.parse(body);
      const context = { slot: 1 };
      const result =
        call.method === "getTokenSupply"
          ? {
              context,
              value: { amount: "1", decimals: 6, uiAmountString: "1" },
            }
          : {
              context,
              value: [
                {
                  pubkey: MINT,
                  account: {
                    data: {
                      parsed: {
                        info: {
                          tokenAmount: {
                            amount: String(holdings.get(call.params[0]) ?? 0n),
                            decimals: 6,
                          },
                        },
                      },
                    },
                  },
                },
              ],
            };
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id: call.id, result }));
    });
  });
  await new Promise<void>((resolve) => rpc.listen(0, "127.0.0.1", resolve));
  rpcUrl = `http://127.0.0.1:${(rpc.address() as AddressInfo).port}`;
});
afterAll(async () => {
  rpc.close();
  await db.pool.end();
  await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
  await admin.end();
});

describe("wallet sign-in", () => {
  it("verifies a signed challenge exactly once", () => {
    const user = keypair();
    const challenge = wallet.createChallenge(
      user.address,
      "https://play.example",
    );
    expect(challenge.message).toContain(
      "play.example wants you to sign in with your Solana account:",
    );
    expect(challenge.message).toContain(user.address);
    const signature = user.sign(challenge.message);
    expect(() =>
      wallet.redeemChallenge(user.address, challenge.nonce, signature),
    ).not.toThrow();
    expect(() =>
      wallet.redeemChallenge(user.address, challenge.nonce, signature),
    ).toThrow(/expired/);
  });
  it("rejects another wallet's signature, wrong address and expiry", () => {
    const user = keypair();
    const other = keypair();
    const first = wallet.createChallenge(user.address, "http://localhost:5173");
    expect(() =>
      wallet.redeemChallenge(
        user.address,
        first.nonce,
        other.sign(first.message),
      ),
    ).toThrow(/could not be verified/);
    const second = wallet.createChallenge(user.address, "http://localhost");
    expect(() =>
      wallet.redeemChallenge(
        other.address,
        second.nonce,
        other.sign(second.message),
      ),
    ).toThrow(/expired/);
    const third = wallet.createChallenge(user.address, "http://localhost", 0);
    expect(() =>
      wallet.redeemChallenge(
        user.address,
        third.nonce,
        user.sign(third.message),
      ),
    ).toThrow(/expired/);
  });
  it("validates Solana addresses", () => {
    expect(wallet.validAddress(keypair().address)).toBe(true);
    expect(wallet.validAddress("not-a-wallet")).toBe(false);
    expect(wallet.validAddress("0".repeat(44))).toBe(false);
  });
});

describe("wallet accounts", () => {
  it("creates, resumes and rotates a wallet account", async () => {
    const user = keypair();
    await expect(db.walletSession(user.address)).rejects.toThrow(
      /explorer name/,
    );
    const created = await db.walletSession(user.address, "Ash");
    expect(created.profile.wallet).toBe(user.address);
    expect(created.profile.balance).toBe(180);
    const again = await db.walletSession(user.address, "Ignored");
    expect(again.profile.id).toBe(created.profile.id);
    expect(again.profile.nickname).toBe("Ash");
    expect(again.token).not.toBe(created.token);
    await expect(db.authenticate(created.token)).rejects.toThrow();
    expect((await db.authenticate(again.token)).id).toBe(created.profile.id);
  });
  it("upgrades the current guest when the wallet is new", async () => {
    const guest = await db.session("Misty");
    const user = keypair();
    const linked = await db.walletSession(user.address, undefined, guest.token);
    expect(linked.linked).toBe(true);
    expect(linked.profile.id).toBe(guest.profile.id);
    expect((await db.getProfile(guest.profile.id)).wallet).toBe(user.address);
    await expect(db.authenticate(guest.token)).rejects.toThrow();
    // A returning wallet keeps its own account; the guest stays separate.
    const second = await db.session("Brock");
    const resumed = await db.walletSession(
      user.address,
      undefined,
      second.token,
    );
    expect(resumed.linked).toBe(false);
    expect(resumed.profile.id).toBe(guest.profile.id);
    expect((await db.authenticate(second.token)).wallet).toBeUndefined();
  });
});

describe("$WOP conversion", () => {
  const config = () =>
    wop.wopConfig({
      WOP_MINT: MINT,
      WOP_PER_PD: "2.5",
      SOLANA_RPC_URL: rpcUrl,
      WOP_MIN_CONVERT_PD: "50",
      WOP_DAILY_PD_LIMIT: "120",
    });
  it("computes token units without floating point", () => {
    expect(wop.wopAmount(100, "2.5", 6)).toBe(250_000_000n);
    expect(wop.wopAmount(3, "0.333333333", 6)).toBe(999_999n);
    expect(wop.formatUnits(250_500_000n, 6)).toBe("250.5");
    expect(wop.wopConfig({}).enabled).toBe(false);
    expect(wop.wopConfig({ WOP_MINT: MINT, WOP_PER_PD: "-1" }).enabled).toBe(
      false,
    );
  });
  it("requires 200K $WOP, debits PD once and enforces limits", async () => {
    const user = keypair();
    const { profile } = await db.walletSession(user.address, "Gary");
    holdings.set(user.address, 199_999n * 10n ** 6n);
    const status = await wop.wopStatus(profile, config());
    expect(status.eligible).toBe(false);
    expect(status.holding).toBe("199999");
    await expect(
      wop.requestConversion(profile, 100, `r:${randomUUID()}`, config()),
    ).rejects.toThrow(/200,000/);

    holdings.set(user.address, 200_000n * 10n ** 6n);
    await expect(
      wop.requestConversion(profile, 10, `r:${randomUUID()}`, config()),
    ).rejects.toThrow(/at least 50/);
    const request = `r:${randomUUID()}`;
    const first = await wop.requestConversion(profile, 100, request, config());
    expect(first.applied).toBe(true);
    expect(first.profile.balance).toBe(80);
    const retry = await wop.requestConversion(profile, 100, request, config());
    expect(retry.applied).toBe(false);
    expect((await db.getProfile(profile.id)).balance).toBe(80);
    await expect(
      wop.requestConversion(profile, 50, `r:${randomUUID()}`, config()),
    ).rejects.toThrow(/per day/);

    const after = await wop.wopStatus(
      await db.getProfile(profile.id),
      config(),
    );
    expect(after.eligible).toBe(true);
    expect(after.convertedToday).toBe(100);
    expect(after.conversions).toMatchObject([
      { pd: 100, amount: "250", status: "pending" },
    ]);
    const ledger = await db.ledger(profile.id);
    expect(ledger.some((row) => row.amount === -100)).toBe(true);
  });
  it("refuses guests and closed conversions", async () => {
    const guest = (await db.session("Tracey")).profile;
    await expect(
      wop.requestConversion(guest, 100, `r:${randomUUID()}`, config()),
    ).rejects.toThrow(/Connect a wallet/);
    await expect(
      wop.requestConversion(guest, 100, `r:${randomUUID()}`, wop.wopConfig({})),
    ).rejects.toThrow(/not open/);
  });
});
