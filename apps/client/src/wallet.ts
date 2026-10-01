import { WALLETS, type WalletKind } from "../../../packages/shared/access";

interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: { toString(): string } | null;
  connect(): Promise<unknown>;
  disconnect?(): Promise<void>;
  signMessage(
    message: Uint8Array,
    display?: "utf8" | "hex",
  ): Promise<Uint8Array | { signature: Uint8Array }>;
}
type WalletWindow = Window & {
  phantom?: { solana?: SolanaProvider };
  solana?: SolanaProvider;
  solflare?: SolanaProvider;
};

export function walletProvider(kind: WalletKind): SolanaProvider | undefined {
  const w = window as WalletWindow;
  if (kind === "phantom")
    return (
      (w.phantom?.solana?.isPhantom ? w.phantom.solana : undefined) ??
      (w.solana?.isPhantom ? w.solana : undefined)
    );
  return w.solflare?.isSolflare ? w.solflare : undefined;
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
function signatureBytes(signed: unknown) {
  const value =
    signed && typeof signed === "object" && "signature" in signed
      ? signed.signature
      : signed;
  if (
    ArrayBuffer.isView(value) &&
    "BYTES_PER_ELEMENT" in value &&
    value.BYTES_PER_ELEMENT === 1 &&
    value.byteLength === 64
  )
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (
    Array.isArray(value) &&
    value.length === 64 &&
    value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  )
    return Uint8Array.from(value);
  throw new Error(
    "The wallet returned an invalid signature. Unlock it and try connecting again.",
  );
}

/**
 * Connect a browser wallet and sign the server's one-time sign-in message.
 * Signing proves ownership; it is not a transaction and costs nothing.
 */
export async function signInWithWallet(
  kind: WalletKind,
  request: (path: string, body: unknown) => Promise<unknown>,
  options: { nickname?: string; guestToken?: string },
) {
  const provider = walletProvider(kind);
  if (!provider) {
    window.open(WALLETS[kind].install, "_blank", "noopener");
    throw new Error(
      `${WALLETS[kind].name} was not found. Install it, then refresh this page.`,
    );
  }
  try {
    await provider.connect();
    const address = provider.publicKey?.toString();
    if (!address)
      throw new Error(`${WALLETS[kind].name} did not share an address.`);
    const challenge = (await request("/api/wallet/challenge", { address })) as {
      nonce: string;
      message: string;
    };
    const signed = await provider.signMessage(
      new TextEncoder().encode(challenge.message),
      "utf8",
    );
    const signature = signatureBytes(signed);
    if (provider.publicKey?.toString() !== address)
      throw new Error(
        "The selected wallet account changed. Please connect again.",
      );
    return (await request("/api/wallet/session", {
      address,
      nonce: challenge.nonce,
      signature: toBase64(signature),
      ...(options.nickname ? { nickname: options.nickname } : {}),
      ...(options.guestToken ? { guestToken: options.guestToken } : {}),
    })) as {
      token: string;
      profile: import("../../../packages/shared/types").Profile;
      linked: boolean;
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 4001
    )
      throw new Error("Wallet connection cancelled. You can try again.");
    throw error;
  }
}
