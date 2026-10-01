import type { Page } from "@playwright/test";
import { createTestWallet } from "../../scripts/wallet-client";
import type { WalletKind } from "../../packages/shared/access";
import { parseSignInMessageText } from "@solana/wallet-standard-util";
export async function installWallet(page: Page, kind: WalletKind) {
  const wallet = createTestWallet();
  await page.exposeFunction("testSignMessage", (message: number[]) => {
    const text = new TextDecoder().decode(Uint8Array.from(message));
    const parsed = parseSignInMessageText(text);
    if (!parsed?.statement || !/^[\x20-\x7e]+$/.test(parsed.statement))
      throw new Error(
        "The app's signature request cannot be shown due to invalid formatting.",
      );
    return Array.from(Buffer.from(wallet.sign(text), "base64"));
  });
  await page.addInitScript(
    ({ address, kind }) => {
      const w = window as any;
      w.walletTest = { connects: 0, signatures: 0, reject: false, delay: 0 };
      const provider = {
        isPhantom: kind === "phantom",
        isSolflare: kind === "solflare",
        publicKey: { toString: () => address },
        async connect() {
          w.walletTest.connects++;
          if (w.walletTest.delay)
            await new Promise((r) => setTimeout(r, w.walletTest.delay));
          if (w.walletTest.reject)
            throw Object.assign(new Error("User rejected the request."), {
              code: 4001,
            });
          return { publicKey: provider.publicKey };
        },
        async signMessage(message: Uint8Array) {
          w.walletTest.signatures++;
          const signature = Uint8Array.from(
            await w.testSignMessage(Array.from(message)),
          );
          return kind === "phantom" ? { signature } : signature;
        },
      };
      if (kind === "phantom") w.phantom = { solana: provider };
      else w.solflare = provider;
      localStorage.setItem(
        "island.settings",
        JSON.stringify({ quality: "low", mute: true }),
      );
    },
    { address: wallet.address, kind },
  );
  return wallet;
}
