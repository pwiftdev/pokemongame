import { afterEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { signInWithWallet, walletProvider } from "../apps/client/src/wallet";
function fixture(
  signature: unknown = { signature: new Uint8Array(64).fill(7) },
) {
  const provider = {
    isPhantom: true,
    publicKey: { toString: () => "test-address" },
    connect: vi.fn(async () => {}),
    signMessage: vi.fn(async () => signature),
  };
  const request = vi.fn(async (path: string) =>
    path.endsWith("challenge")
      ? { nonce: "challenge", message: "Sign in" }
      : {
          token: "test-session",
          profile: { wallet: "test-address" },
          linked: false,
        },
  );
  vi.stubGlobal("window", {
    phantom: { solana: provider },
    solana: { isBraveWallet: true },
    open: vi.fn(),
  });
  return { provider, request };
}
afterEach(() => vi.unstubAllGlobals());
describe("wallet provider compatibility", () => {
  it("chooses Phantom rather than Brave's generic Solana provider", async () => {
    const f = fixture();
    expect(walletProvider("phantom")).toBe(f.provider);
    await signInWithWallet("phantom", f.request, {});
    expect(f.request).toHaveBeenLastCalledWith(
      "/api/wallet/session",
      expect.objectContaining({
        signature: Buffer.alloc(64, 7).toString("base64"),
      }),
    );
  });
  it("accepts raw signatures from another extension realm", async () => {
    const f = fixture(runInNewContext("new Uint8Array(64).fill(7)"));
    await expect(
      signInWithWallet("phantom", f.request, {}),
    ).resolves.toHaveProperty("token");
  });
  it("rejects malformed signatures and account changes before sending them to the server", async () => {
    const f = fixture(new Uint8Array(12));
    await expect(signInWithWallet("phantom", f.request, {})).rejects.toThrow(
      /invalid signature/,
    );
    expect(f.request).toHaveBeenCalledTimes(1);
    f.provider.signMessage.mockImplementation(async () => {
      f.provider.publicKey = { toString: () => "changed-address" };
      return new Uint8Array(64);
    });
    await expect(signInWithWallet("phantom", f.request, {})).rejects.toThrow(
      /account changed/,
    );
    expect(f.request).toHaveBeenCalledTimes(2);
  });
  it("handles user cancellation without requesting a server challenge", async () => {
    const f = fixture();
    f.provider.connect.mockRejectedValueOnce({ code: 4001 });
    await expect(signInWithWallet("phantom", f.request, {})).rejects.toThrow(
      /cancelled/,
    );
    expect(f.request).not.toHaveBeenCalled();
  });
});
