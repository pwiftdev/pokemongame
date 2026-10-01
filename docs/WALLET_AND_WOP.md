# Wallets, guests, $WOP and chat

## Public contract button

`VITE_WOP_CA` supplies the public Solana contract address for both the title-screen and loading-screen copy buttons. Leave it empty until the address is confirmed; both buttons stay disabled and show “CA coming soon”. Once supplied, set it to the same mint used for `WOP_MINT` and rebuild the client. This public display setting does not enable token conversion. Never place a private key in a `VITE_` variable.

## Sign-in

The title screen offers **Connect Phantom**, **Connect Solflare** or **Play as guest**. Wallets are detected from their injected providers (`window.phantom.solana`, `window.solflare`); no wallet SDK is bundled. A missing wallet opens its download page.

Wallet sign-in follows the Sign-In With Solana message format:

1. `POST /api/wallet/challenge { address }` returns a one-time message built by `@solana/wallet-standard-util`, with the site's domain, a nonce and a five-minute expiry. The statement uses ASCII (`World of Pokemon`): accented branding such as `Pokémon` violates the SIWS statement grammar and causes Phantom to reject the signature request. Nonces live in server memory, so a restart only asks the player to sign again.
2. The wallet signs the message (`signMessage`). This is not a transaction and costs nothing.
3. `POST /api/wallet/session { address, nonce, signature, nickname?, guestToken? }` verifies the ed25519 signature with Node's crypto, consumes the nonce and returns the same 256-bit session token used by guests.

A new title-screen wallet sign-in without a nickname starts as Explorer; the character creator can rename it. Guest linking ignores repeat clicks while a wallet prompt is open. Cancellation leaves the guest account intact. Raw signature bytes from extension contexts and Phantom signature objects are supported.

A returning wallet gets a fresh token (older sessions for that wallet stop working). A new wallet upgrades the guest account in this browser, keeping its progress; otherwise a new account is created with the chosen name. The wallet is stored in `players.wallet` (unique) and on the profile. Linking from inside the game (the wallet pill in the HUD) lifts guest limits immediately, without reconnecting.

## Guest limits

Accounts without a wallet are guests. The server enforces every limit; the client only mirrors them.

- Movement stays inside Hearthwick and Sunpetal Meadows (`guestStep` in `packages/shared/access.ts`, applied to walking and dashing on the server and in client prediction, plus server-authoritative Blink, Shadowstep, and Charge). Waystone travel outside that area is refused.
- Taming, the shop (including equipment purchases), evolution, Pokédex PD rewards, duels and the arena queue are refused (`WALLET_COMMANDS`).
- Guests can read chat but not post.
- Guests can still fight the monsters in the meadow camps and follow the opening story.

## $WOP conversion

Wallet players open the **$WOP wallet** panel from the HUD. A conversion:

1. Requires conversions to be configured (`WOP_MINT`, `WOP_PER_PD`).
2. Reads the wallet's live $WOP balance from Solana (`getTokenAccountsByOwner` for the mint, all token accounts summed). It must be at least `WOP_MIN_HOLDING` (default 200,000).
3. Checks the minimum per conversion and the rolling 24-hour limit.
4. In one database transaction: locks the player, debits PD in the append-only ledger, and queues a `wop_conversions` row. The request ID makes retries safe.

Amounts use integer token units (`pd × WOP_PER_PD × 10^decimals`, decimals read from the mint), never floating point.

### Payouts

With `WOP_TREASURY_SECRET` set, the server pays queued conversions from that wallet every 15 seconds, one at a time. Each payout creates the player's associated token account if needed and sends a `transferChecked` from the treasury's token account. Classic SPL and Token-2022 mints both work.

A payout is written down as `processing` with its transaction signature and last valid block height **before** it is broadcast. It becomes `sent` once confirmed. Only after the chain is past that height (plus a margin) with no record of the transaction is it marked `failed` and the PD refunded. A payout is therefore never sent twice, even across crashes or RPC timeouts. Without a treasury key, conversions stay `pending` for manual payout.

Treat the treasury as a hot wallet: fund it with SOL for fees and only a working float of $WOP, top it up from cold storage, and watch `wop_conversions` for `failed` rows.

### Configuration

| Variable                     | Default                               | Meaning                                                   |
| ---------------------------- | ------------------------------------- | --------------------------------------------------------- |
| `WOP_MINT`                   | unset (conversions closed)            | $WOP mint address after the pump.fun launch               |
| `WOP_PER_PD`                 | unset (conversions closed)            | $WOP paid per PD, e.g. `10` or `0.5`                      |
| `SOLANA_RPC_URL`             | `https://api.mainnet-beta.solana.com` | Use a dedicated RPC (Helius, Triton, QuickNode) in public |
| `WOP_MIN_HOLDING`            | `200000`                              | Whole $WOP a wallet must hold to convert                  |
| `WOP_MIN_CONVERT_PD`         | `100`                                 | Smallest conversion                                       |
| `WOP_DAILY_PD_LIMIT`         | `5000`                                | PD a player may convert per rolling 24 hours              |
| `WOP_TREASURY_SECRET`        | unset (manual payouts)                | Treasury secret key: base58 or `solana-keygen` JSON array |
| `WOP_PRIORITY_MICROLAMPORTS` | `0`                                   | Compute-unit price for payouts when the network is busy   |
| `WOP_PAYOUT_INTERVAL_MS`     | `15000`                               | Payout cycle interval                                     |

The public mainnet RPC rate-limits `getTokenAccountsByOwner`; set `SOLANA_RPC_URL` before launch.

## Chat

Press **Enter** to open chat, **Enter** to send and **Esc** to close. Messages go to everyone on the island and appear as speech bubbles above the speaker for six seconds. New arrivals receive the last 30 messages.

The server trims and normalizes text, removes control and invisible characters, limits messages to 140 characters, allows five messages per ten seconds, refuses an identical repeat, and blocks links and wallet addresses to stop scam and fake-contract posts. Text is always rendered escaped.

## Verification

- `npm test` covers signature checks, nonce reuse and expiry, wallet account creation, rotation and guest upgrade, the holding requirement, PD debit, retry safety, limits, payout transaction contents, confirmation and expiry refunds (against a mock Solana RPC), guest regions and chat filtering.
- `npm run test:wallet` runs against a live server: guests stop at the Lanternwood border while wallet players cross it, guests cannot tame, duel, buy or chat, chat reaches the room and late joiners, links are refused, and a guest upgrades in place and can leave town without reconnecting.

Browser regression tests in `tests/browser/wallet.spec.ts` exercise the actual Connect buttons with signed Phantom/Solflare provider fixtures and a strict sign-in statement check. They cover new accounts without a name, saved sessions, cancellation, repeated link clicks, and guest progress after linking. These fixtures do not automate an installed wallet extension.
