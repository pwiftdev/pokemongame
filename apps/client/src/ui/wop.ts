import {
  WALLETS,
  WOP,
  shortAddress,
  type WalletKind,
} from "../../../../packages/shared/access";
import type { Profile } from "../../../../packages/shared/types";
import { escape as esc, icon } from "./icons";

export interface WopStatus {
  enabled: boolean;
  mint: string | null;
  rate: string | null;
  minHolding: number;
  minPd: number;
  dailyPd: number;
  wallet: string | null;
  balance: number;
  holding: string | null;
  eligible: boolean;
  convertedToday: number;
  conversions: Array<{
    id: string;
    pd: number;
    amount: string;
    status: "pending" | "processing" | "sent" | "failed";
    signature: string | null;
    error: string | null;
    createdAt: string;
  }>;
}

const whole = (value: number | string) =>
  Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });

export function walletButtons(action: string, disabled = false) {
  return (Object.keys(WALLETS) as WalletKind[])
    .map(
      (kind) =>
        `<button class="primary wallet-button wallet-${kind}" data-action="${action}:${kind}" ${disabled ? "disabled" : ""}>${icon("wallet")}<span>Connect ${WALLETS[kind].name}</span></button>`,
    )
    .join("");
}

const statusLabel = {
  pending: "Queued",
  processing: "Sending",
  sent: "Sent",
  failed: "Refunded",
};

/** The $WOP panel: wallet, holding requirement and PD conversion. */
export function wopPanel(
  profile: Profile | undefined,
  status: WopStatus | undefined,
  loading: boolean,
  currency: string,
) {
  if (!profile?.wallet)
    return `<div class="wop-hero">${icon("wallet")}<div><span class="eyebrow">PLAYING AS A GUEST</span><h3>Connect a wallet to unlock the whole isle</h3><p>Guests can explore Hearthwick and Sunpetal Meadows and battle the monsters there. Sign in with Phantom or Solflare to tame Pokémon, trade at the shop, duel, chat, travel everywhere and earn ${WOP.symbol}.</p></div></div><div class="wallet-buttons">${walletButtons("wallet-link")}</div><p class="subtle">Your guest progress moves to the wallet if the wallet is new to ${esc(WOP.name)}. Signing in only signs a message; it never sends a transaction or costs a fee.</p>`;
  const head = `<div class="wop-hero">${icon("wallet")}<div><span class="eyebrow">CONNECTED WALLET</span><h3 title="${esc(profile.wallet)}">${esc(shortAddress(profile.wallet))}</h3><p>${esc(currency)} you earn in the game can be converted to ${WOP.symbol}, the ${esc(WOP.name)} token on Solana.</p></div></div>`;
  if (loading && !status)
    return `${head}<p class="subtle">Checking your wallet…</p>`;
  if (!status?.enabled)
    return `${head}<div class="notice">${icon("coin")}<span><strong>${WOP.symbol} launches on pump.fun.</strong> Conversions open once the token is live. Keep earning ${esc(currency)} until then.</span></div>`;
  const needed = whole(status.minHolding);
  const left = Math.max(0, status.dailyPd - status.convertedToday);
  const max = Math.min(status.balance, left);
  const form = status.eligible
    ? `<div class="wop-convert"><label for="wop-pd">${esc(currency)} to convert</label><div><input id="wop-pd" data-focus="wop-pd" type="number" inputmode="numeric" min="${status.minPd}" max="${Math.max(status.minPd, max)}" step="1" value="${Math.max(status.minPd, Math.min(max, status.minPd))}" /><output id="wop-preview"></output></div>${`<button class="primary" data-action="wop-convert" ${max < status.minPd ? "disabled" : ""}>Convert to ${WOP.symbol}</button>`}<small class="subtle">Rate: 1 ${esc(currency)} = ${esc(status.rate)} ${WOP.symbol} · Minimum ${status.minPd} ${esc(currency)} · ${left.toLocaleString()} of ${status.dailyPd.toLocaleString()} ${esc(currency)} left today</small></div>`
    : `<div class="notice">${icon("shield")}<span>Hold at least <strong>${needed} ${WOP.symbol}</strong> in this wallet to convert ${esc(currency)}. You hold ${whole(status.holding ?? 0)}.</span></div>`;
  const history = status.conversions
    .map(
      (row) =>
        `<div class="record-row"><span>${row.pd.toLocaleString()} ${esc(currency)} → ${whole(row.amount)} ${WOP.symbol}<small>${esc(new Date(row.createdAt).toLocaleString())}${row.error ? ` · ${esc(row.error)}` : ""}</small></span><strong class="wop-status ${row.status}">${row.signature && row.status === "sent" ? `<a href="https://solscan.io/tx/${esc(row.signature)}" target="_blank" rel="noopener">${statusLabel[row.status]}</a>` : statusLabel[row.status]}</strong></div>`,
    )
    .join("");
  return `${head}<div class="wop-stats"><div><small>${WOP.symbol} HELD</small><strong>${whole(status.holding ?? 0)}</strong></div><div><small>REQUIRED</small><strong>${needed}</strong></div><div><small>${esc(currency)} AVAILABLE</small><strong>${status.balance.toLocaleString()}</strong></div></div>${form}<div class="section-heading"><h3>Conversions</h3></div>${history || '<p class="subtle">Your conversions will appear here.</p>'}`;
}

/** Live "you receive" preview under the PD input. */
export function updateWopPreview(status: WopStatus | undefined) {
  const input = document.querySelector<HTMLInputElement>("#wop-pd");
  const output = document.querySelector<HTMLOutputElement>("#wop-preview");
  if (!input || !output || !status?.rate) return;
  const amount = Math.max(0, Math.floor(Number(input.value) || 0));
  output.value = `≈ ${whole(amount * Number(status.rate))} ${WOP.symbol}`;
}
