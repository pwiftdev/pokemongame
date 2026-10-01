export const CHAT = {
  maxLength: 140,
  /** Messages kept for players who join a room. */
  history: 30,
  /** How long a chat bubble stays above a player, in milliseconds. */
  bubbleMs: 6000,
};

export interface ChatMessage {
  id: string;
  playerId: string;
  nickname: string;
  text: string;
  time: number;
}

const hidden = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const link =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|xyz|gg|app|fun|link|me|co|ru|sol|site|online|top|live|finance|exchange)\b)/i;
const address = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;

/** Normalize a chat line, or explain why it cannot be posted. */
export function cleanChat(
  raw: string,
): { ok: true; text: string } | { ok: false; reason: string } {
  const text = raw
    .normalize("NFKC")
    .replace(hidden, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return { ok: false, reason: "Type a message first." };
  if ([...text].length > CHAT.maxLength)
    return {
      ok: false,
      reason: `Keep messages under ${CHAT.maxLength} characters.`,
    };
  if (link.test(text) || address.test(text))
    return {
      ok: false,
      reason: "Links and wallet addresses can't be posted in chat.",
    };
  return { ok: true, text };
}
