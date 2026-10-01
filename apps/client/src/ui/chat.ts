import {
  CHAT,
  cleanChat,
  type ChatMessage,
} from "../../../../packages/shared/chat";
import { escape as esc } from "./icons";

const KEEP = 60;
const FADE_MS = 12000;

/** Room chat: Enter opens the input, Enter sends, Escape closes. */
export function createChat(
  root: HTMLElement,
  options: {
    selfId: () => string | undefined;
    /** A reason the player cannot post, such as being a guest. */
    blocked: () => string | null;
    send: (text: string) => void;
    error: (message: string) => void;
  },
) {
  root.innerHTML = `<div class="chat-log" role="log" aria-label="Chat"></div><form class="chat-form hidden" autocomplete="off"><label class="sr-only" for="chat-input">Chat message</label><input id="chat-input" maxlength="${CHAT.maxLength}" enterkeyhint="send" /><kbd>Esc</kbd></form><div class="chat-hint"><kbd>Enter</kbd> Chat</div>`;
  const log = root.querySelector<HTMLElement>(".chat-log")!;
  const form = root.querySelector<HTMLFormElement>(".chat-form")!;
  const input = form.querySelector<HTMLInputElement>("input")!;
  let open = false;

  function close() {
    open = false;
    input.value = "";
    form.classList.add("hidden");
    root.classList.remove("open");
    input.blur();
    document.querySelector<HTMLCanvasElement>("#world")?.focus();
  }
  function submit() {
    const text = input.value;
    if (!text.trim()) return close();
    const reason = options.blocked();
    if (reason) return options.error(reason);
    const clean = cleanChat(text);
    if (!clean.ok) return options.error(clean.reason);
    options.send(clean.text);
    close();
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });
  input.addEventListener("blur", () => {
    if (open && !input.value.trim()) close();
  });

  return {
    get open() {
      return open;
    },
    input,
    show() {
      open = true;
      const reason = options.blocked();
      input.disabled = !!reason;
      input.placeholder =
        reason ?? "Say something to this island… Enter to send";
      form.classList.remove("hidden");
      root.classList.add("open");
      log.scrollTop = log.scrollHeight;
      if (!reason) window.setTimeout(() => input.focus());
    },
    close,
    add(message: ChatMessage) {
      const line = document.createElement("p");
      line.className = `chat-line${message.playerId === options.selfId() ? " self" : ""}`;
      line.innerHTML = `<strong>${esc(message.nickname)}</strong><span>${esc(message.text)}</span>`;
      line.dataset.time = String(Date.now());
      log.append(line);
      while (log.children.length > KEEP) log.firstElementChild?.remove();
      log.scrollTop = log.scrollHeight;
      root.classList.add("recent");
      window.setTimeout(() => {
        const last = Number(
          (log.lastElementChild as HTMLElement | null)?.dataset.time ?? 0,
        );
        if (Date.now() - last >= FADE_MS - 50) root.classList.remove("recent");
      }, FADE_MS);
    },
    clear() {
      log.innerHTML = "";
    },
  };
}
export type Chat = ReturnType<typeof createChat>;
