import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import pg from "pg";
import {
  createKeyPairSignerFromBytes,
  getBase58Decoder,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from "@solana/kit";
import { TOKEN_2022_PROGRAM_ADDRESS } from "@solana-program/token-2022";

const baseUrl =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/pokemon_dollars";
const admin = new pg.Pool({ connectionString: baseUrl });
const namespace = `test_${randomUUID().replaceAll("-", "")}`;
const testUrl = new URL(baseUrl);
testUrl.searchParams.set("options", `-c search_path=${namespace}`);
process.env.DATABASE_URL = testUrl.toString();
const db = await import("../db.js");
const wop = await import("../wop.js");
const { WopPayouts, parseSecretKey } = await import("../wop-payout.js");

const MINT = "So11111111111111111111111111111111111111112";
const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";
const sent: string[] = [];
let height = 100;
const statuses = new Map<string, unknown>();
let rpc: Server;
let rpcUrl = "";

function walletAddress() {
  const { publicKey } = generateKeyPairSync("ed25519");
  const raw = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
  return getBase58Decoder().decode(raw);
}
function treasurySecret() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const seed = Buffer.from(
    privateKey.export({ format: "jwk" }).d!,
    "base64url",
  );
  const pub = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
  return Uint8Array.from([...seed, ...pub]);
}

beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${namespace}`);
  await db.migrate();
  rpc = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const call = JSON.parse(body);
      const context = { slot: 1 };
      const results: Record<string, () => unknown> = {
        getTokenSupply: () => ({
          context,
          value: { amount: "1", decimals: 6, uiAmountString: "1" },
        }),
        getAccountInfo: () => ({
          context,
          value: {
            owner: TOKEN_2022_PROGRAM_ADDRESS,
            data: ["", "base64"],
            executable: false,
            lamports: 1,
            rentEpoch: 0,
            space: 0,
          },
        }),
        getLatestBlockhash: () => ({
          context,
          value: { blockhash: BLOCKHASH, lastValidBlockHeight: 150 },
        }),
        sendTransaction: () => {
          sent.push(call.params[0]);
          return "ignored";
        },
        getBlockHeight: () => height,
        getSignatureStatuses: () => ({
          context,
          value: (call.params[0] as string[]).map(
            (signature) => statuses.get(signature) ?? null,
          ),
        }),
      };
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: call.id,
          result: results[call.method]!(),
        }),
      );
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

async function queued(pd: number) {
  const { profile } = await db.walletSession(walletAddress(), "Payee");
  const id = randomUUID();
  await db.mutate(profile.id, `seed:${id}`, async (locked, tx) => {
    await tx.credit(locked, -pd, "$WOP conversion", `wop:${id}`);
    await tx.client.query(
      "INSERT INTO wop_conversions(id,player_id,wallet,pd,amount) VALUES($1,$2,$3,$4,$5)",
      [id, locked.id, locked.wallet, pd, String(BigInt(pd) * 2_500_000n)],
    );
  });
  return { id, profile };
}
const row = async (id: string) =>
  (await db.pool.query("SELECT * FROM wop_conversions WHERE id=$1", [id]))
    .rows[0];

describe("$WOP payouts", () => {
  it("parses solana-keygen and base58 secret keys", () => {
    const secret = treasurySecret();
    expect(parseSecretKey(JSON.stringify([...secret]))).toEqual(secret);
    expect(parseSecretKey(getBase58Decoder().decode(secret))).toEqual(secret);
    expect(() => parseSecretKey("[1,2,3]")).toThrow(/64-byte/);
  });
  it("records the signature before broadcasting a checked transfer", async () => {
    const treasury = await createKeyPairSignerFromBytes(treasurySecret());
    const changed: string[] = [];
    const payouts = new WopPayouts(
      wop.wopConfig({
        WOP_MINT: MINT,
        WOP_PER_PD: "2.5",
        SOLANA_RPC_URL: rpcUrl,
      }),
      treasury,
      5000n,
      (id) => changed.push(id),
    );
    const { id, profile } = await queued(40);
    await payouts.tick();
    const processing = await row(id);
    expect(processing.status).toBe("processing");
    expect(processing.last_valid_height).toBe("150");
    expect(sent).toHaveLength(1);

    const wire = getTransactionDecoder().decode(
      getBase64Encoder().encode(sent[0]),
    );
    const signature = getBase58Decoder().decode(
      Object.values(wire.signatures)[0]!,
    );
    expect(signature).toBe(processing.signature);
    const message = getCompiledTransactionMessageDecoder().decode(
      wire.messageBytes,
    );
    if (message.version !== 0) throw new Error("Expected a v0 transaction.");
    const programs = message.instructions.map(
      (ix) => message.staticAccounts[ix.programAddressIndex],
    );
    expect(programs).toEqual([
      "ComputeBudget111111111111111111111111111111",
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      TOKEN_2022_PROGRAM_ADDRESS,
    ]);
    const transfer = message.instructions[2].data!;
    expect(transfer[0]).toBe(12);
    expect(Buffer.from(transfer.slice(1, 9)).readBigUInt64LE()).toBe(
      100_000_000n,
    );
    expect(transfer[9]).toBe(6);
    expect(message.staticAccounts).toContain(profile.wallet);

    statuses.set(processing.signature, {
      slot: 2,
      confirmations: 1,
      err: null,
      confirmationStatus: "confirmed",
    });
    await payouts.tick();
    expect((await row(id)).status).toBe("sent");
    expect(sent).toHaveLength(1);
    expect(changed).toEqual([]);
  });
  it("refunds PD only after an unconfirmed payout expires", async () => {
    const treasury = await createKeyPairSignerFromBytes(treasurySecret());
    const changed: string[] = [];
    const payouts = new WopPayouts(
      wop.wopConfig({
        WOP_MINT: MINT,
        WOP_PER_PD: "2.5",
        SOLANA_RPC_URL: rpcUrl,
      }),
      treasury,
      0n,
      (id) => changed.push(id),
    );
    const { id, profile } = await queued(60);
    await payouts.tick();
    expect((await row(id)).status).toBe("processing");
    expect((await db.getProfile(profile.id)).balance).toBe(120);

    height = 200; // past 150 but inside the safety margin
    await payouts.tick();
    expect((await row(id)).status).toBe("processing");

    height = 400;
    await payouts.tick();
    await payouts.tick();
    const failed = await row(id);
    expect(failed.status).toBe("failed");
    expect(failed.error).toMatch(/refunded/);
    expect((await db.getProfile(profile.id)).balance).toBe(180);
    expect(changed).toEqual([profile.id]);
    const refunds = (await db.ledger(profile.id)).filter(
      (entry) => entry.reason === "$WOP refund",
    );
    expect(refunds).toHaveLength(1);
    height = 100;
  });
});
