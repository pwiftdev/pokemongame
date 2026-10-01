import { createWalletSession } from "./wallet-client.js";
/**
 * Network check for wallet sign-in, guest limits and chat against a running
 * server: npm start, then npm run test:wallet.
 */
import type { ChatMessage } from "../packages/shared/chat.js";
import { regionBiome } from "../packages/shared/regions.js";
import { base, delay, NetworkPlayer, until } from "./network-client.js";

function chatInbox(player: NetworkPlayer) {
  const messages: ChatMessage[] = [];
  player.room.onMessage("chat", (message: ChatMessage) =>
    messages.push(message),
  );
  let history: ChatMessage[] | undefined;
  player.room.onMessage(
    "chatHistory",
    (list: ChatMessage[]) => (history = list),
  );
  player.room.send("chatHistory");
  return Object.assign(messages, { history: () => history });
}
/** Follow the east road from Hearthwick into Lanternwood. */
async function walkToForest(player: NetworkPlayer) {
  await player.go(10, -28);
  await player.go(23, -17);
  await player.go(29, 1, 8000).catch(() => player.stop());
  await delay(300);
  return player.self!;
}
const inForest = (p: { x: number; z: number }) =>
  regionBiome(p.x, p.z) === "forest";
const results: Record<string, unknown> = {};
const check = (name: string, ok: boolean, detail?: unknown) => {
  results[name] = ok ? "pass" : { fail: detail };
  if (!ok) process.exitCode = 1;
};

const guest = await NetworkPlayer.create("Guest Scout", undefined, "new");
const guestChat = chatInbox(guest);
await guest.starter();
const walletAuth = await createWalletSession(base, "Wallet Scout");
check("new wallet account", walletAuth.profile.wallet !== undefined);
const holder = await NetworkPlayer.create(
  "unused",
  walletAuth.token,
  guest.room.roomId,
);
const holderChat = chatInbox(holder);
await holder.starter();

const guestAt = await walkToForest(guest);
check("guest stops at the Lanternwood border", !inForest(guestAt), guestAt);
const holderAt = await walkToForest(holder);
check("wallet explorer enters Lanternwood", inForest(holderAt), holderAt);

guest.errors.length = 0;
guest.send({ kind: "tame", target: "none", item: "capsule" });
guest.send({ kind: "duel", target: holder.profile.id });
guest.send({ kind: "buy", item: "potion", quantity: 1 });
guest.send({ kind: "gearBuy", item: "mage-weapon-1" });
await until(
  () => guest.errors.length >= 4,
  4000,
  () => String(guest.errors),
);
check(
  "guest cannot tame, duel or buy",
  guest.errors.every((e) => /wallet/i.test(e)),
  guest.errors,
);

guest.errors.length = 0;
guest.room.send("chat", { text: "hello?" });
await until(() => guest.errors.length > 0, 4000);
check("guest chat is read-only", /wallet/i.test(guest.errors[0]), guest.errors);

holder.room.send("chat", { text: "  Hello   island!  " });
await until(() => guestChat.length > 0 && holderChat.length > 0, 4000);
check(
  "wallet chat reaches the room",
  guestChat[0].text === "Hello island!" &&
    guestChat[0].playerId === holder.profile.id,
  guestChat,
);
holder.errors.length = 0;
holder.room.send("chat", { text: "claim at https://scam.example" });
await until(() => holder.errors.length > 0, 4000);
check("links are refused", /Links/.test(holder.errors[0]), holder.errors);

const late = await NetworkPlayer.create(
  "Late Scout",
  undefined,
  guest.room.roomId,
);
const lateChat = chatInbox(late);
await until(() => !!lateChat.history(), 4000, "chat history");
check(
  "late joiners receive recent chat",
  lateChat.history()!.some((m) => m.text === "Hello island!"),
  lateChat.history(),
);
await late.close();

const linked = await createWalletSession(base, undefined, guest.token);
check(
  "guest upgrades in place",
  linked.linked && linked.profile.id === guest.profile.id,
  linked,
);
await until(() => !!guest.profile.wallet, 4000, "profile reload");
await guest.go(29, 1, 8000);
check(
  "upgraded guest can leave without reconnecting",
  inForest(guest.self!),
  guest.self,
);

console.log(JSON.stringify(results, null, 2));
await guest.close();
await holder.close();
process.exit();
