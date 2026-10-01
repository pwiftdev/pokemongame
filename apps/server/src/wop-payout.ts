import {
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createTransactionMessage,
  getBase58Encoder,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  signature as toSignature,
  type Base64EncodedWireTransaction,
  type KeyPairSigner,
} from "@solana/kit";
import { getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import { WOP } from "../../../packages/shared/access.js";
import { mutate, pool } from "./db.js";
import { mintDecimals, solanaRpc, wopConfig, type WopConfig } from "./wop.js";

/** Accepts a base58 secret key or the JSON byte array written by solana-keygen. */
export function parseSecretKey(secret: string) {
  const trimmed = secret.trim();
  const bytes = trimmed.startsWith("[")
    ? Uint8Array.from(JSON.parse(trimmed) as number[])
    : Uint8Array.from(getBase58Encoder().encode(trimmed));
  if (bytes.length !== 64)
    throw new Error("WOP_TREASURY_SECRET must be a 64-byte Solana secret key.");
  return bytes;
}

const EXPIRY_MARGIN = 150n;

interface Row {
  id: string;
  player_id: string;
  wallet: string;
  pd: number;
  amount: string;
  signature: string | null;
  last_valid_height: string | null;
}

/**
 * Pays queued conversions from the treasury wallet, one at a time.
 *
 * A payout is recorded as "processing" with its signature before it is
 * broadcast. It becomes "sent" once confirmed. Only when its blockhash has
 * expired without the transaction landing is it marked "failed" and the PD
 * refunded, so a payout is never sent twice.
 */
export class WopPayouts {
  private tokenProgram?: string;
  private running = false;
  constructor(
    private readonly config: WopConfig,
    private readonly treasury: KeyPairSigner,
    private readonly priorityMicroLamports: bigint,
    private readonly onProfileChange: (playerId: string) => void,
  ) {}

  private get rpc() {
    return solanaRpc(this.config.rpcUrl);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.reconcile();
      await this.sendNext();
    } catch (error) {
      console.error(`${WOP.symbol} payout cycle failed`, error);
    } finally {
      this.running = false;
    }
  }

  private async program() {
    if (this.tokenProgram) return this.tokenProgram;
    const info = await this.rpc
      .getAccountInfo(address(this.config.mint!), { encoding: "base64" })
      .send();
    const owner = info.value?.owner;
    if (owner !== TOKEN_PROGRAM_ADDRESS && owner !== TOKEN_2022_PROGRAM_ADDRESS)
      throw new Error(`${WOP.symbol} mint is not an SPL token.`);
    this.tokenProgram = owner;
    return owner;
  }

  private async reconcile() {
    const rows = await pool.query<Row>(
      "SELECT * FROM wop_conversions WHERE status='processing' ORDER BY created_at LIMIT 50",
    );
    if (!rows.rowCount) return;
    // Read the height before the statuses: once the chain is past a payout's
    // last valid height (plus a margin), a missing status means it never landed.
    const height = await this.rpc
      .getBlockHeight({ commitment: "confirmed" })
      .send();
    const signatures = rows.rows.map((row) => toSignature(row.signature!));
    const statuses = await this.rpc
      .getSignatureStatuses(signatures, { searchTransactionHistory: true })
      .send();
    for (const [index, row] of rows.rows.entries()) {
      const status = statuses.value[index];
      if (status?.err) await this.fail(row, "The transfer was rejected.");
      else if (
        status?.confirmationStatus === "confirmed" ||
        status?.confirmationStatus === "finalized"
      )
        await pool.query(
          "UPDATE wop_conversions SET status='sent',updated_at=now() WHERE id=$1 AND status='processing'",
          [row.id],
        );
      else if (
        !status &&
        height > BigInt(row.last_valid_height ?? 0) + EXPIRY_MARGIN
      )
        await this.fail(row, "The transfer expired before it landed.");
    }
  }

  private async fail(row: Row, reason: string) {
    await mutate(row.player_id, `wop-refund:${row.id}`, async (profile, tx) => {
      const updated = await tx.client.query(
        "UPDATE wop_conversions SET status='failed',error=$2,updated_at=now() WHERE id=$1 AND status='processing' RETURNING id",
        [row.id, `${reason} Your PD was refunded.`],
      );
      if (updated.rowCount)
        await tx.credit(
          profile,
          row.pd,
          `${WOP.symbol} refund`,
          `wop-refund:${row.id}`,
        );
    });
    this.onProfileChange(row.player_id);
  }

  private async sendNext() {
    const program = await this.program();
    const decimals = await mintDecimals(this.config);
    const mint = address(this.config.mint!);
    const client = await pool.connect();
    let failed = false;
    let wire: Base64EncodedWireTransaction | undefined;
    try {
      await client.query("BEGIN");
      const next = await client.query<Row>(
        "SELECT * FROM wop_conversions WHERE status='pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED",
      );
      const row = next.rows[0];
      if (!row) {
        await client.query("COMMIT");
        return;
      }
      const owner = address(row.wallet);
      const [source] = await findAssociatedTokenPda({
        owner: this.treasury.address,
        mint,
        tokenProgram: address(program),
      });
      const [destination] = await findAssociatedTokenPda({
        owner,
        mint,
        tokenProgram: address(program),
      });
      const { value: blockhash } = await this.rpc
        .getLatestBlockhash({ commitment: "confirmed" })
        .send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(this.treasury, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
        (m) =>
          appendTransactionMessageInstructions(
            [
              ...(this.priorityMicroLamports > 0n
                ? [
                    getSetComputeUnitPriceInstruction({
                      microLamports: this.priorityMicroLamports,
                    }),
                  ]
                : []),
              getCreateAssociatedTokenIdempotentInstruction({
                payer: this.treasury,
                ata: destination,
                owner,
                mint,
                tokenProgram: address(program),
              }),
              getTransferCheckedInstruction(
                {
                  source,
                  mint,
                  destination,
                  authority: this.treasury,
                  amount: BigInt(row.amount),
                  decimals,
                },
                { programAddress: address(program) },
              ),
            ],
            m,
          ),
      );
      const transaction = await signTransactionMessageWithSigners(message);
      await client.query(
        "UPDATE wop_conversions SET status='processing',signature=$2,last_valid_height=$3,updated_at=now() WHERE id=$1",
        [
          row.id,
          getSignatureFromTransaction(transaction),
          blockhash.lastValidBlockHeight.toString(),
        ],
      );
      await client.query("COMMIT");
      wire = getBase64EncodedWireTransaction(transaction);
    } catch (error) {
      failed = true;
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release(failed);
    }
    if (!wire) return;
    // Broadcast only after the signature is durable. A failed broadcast is
    // resolved by reconcile() once the blockhash expires.
    await this.rpc
      .sendTransaction(wire, {
        encoding: "base64",
        preflightCommitment: "confirmed",
        maxRetries: 5n,
      })
      .send()
      .catch((error) =>
        console.error(`${WOP.symbol} payout broadcast failed`, error),
      );
  }
}

/** Start automatic payouts when a treasury key is configured. */
export async function startWopPayouts(
  onProfileChange: (playerId: string) => void,
  env = process.env,
) {
  const config = wopConfig(env);
  if (!config.enabled || !env.WOP_TREASURY_SECRET) {
    if (config.enabled)
      console.log(
        `${WOP.symbol} conversions are queued; set WOP_TREASURY_SECRET to pay them automatically.`,
      );
    return undefined;
  }
  const treasury = await createKeyPairSignerFromBytes(
    parseSecretKey(env.WOP_TREASURY_SECRET),
  );
  const payouts = new WopPayouts(
    config,
    treasury,
    BigInt(env.WOP_PRIORITY_MICROLAMPORTS || "0"),
    onProfileChange,
  );
  const interval = Math.max(5000, Number(env.WOP_PAYOUT_INTERVAL_MS) || 15000);
  setInterval(() => void payouts.tick(), interval).unref();
  console.log(
    `${WOP.symbol} payouts enabled from treasury ${treasury.address}.`,
  );
  return payouts;
}
