import { startup } from "./progress";
let frame = 0;
let unsubscribe: (() => void) | undefined;
let patience: ReturnType<typeof setTimeout> | undefined;
function paint() {
  frame = 0;
  const tasks = startup.tasks,
    done = tasks.filter((task) => task.state === "ready").length;
  const progress =
    document.querySelector<HTMLProgressElement>("#boot-progress")!;
  progress.max = Math.max(1, tasks.length);
  progress.value = done;
  progress.setAttribute(
    "aria-valuetext",
    `${done} of ${tasks.length} assets ready`,
  );
}
function showRecovery(message: string) {
  document.querySelector<HTMLElement>("#boot-recovery")!.hidden = false;
  document.querySelector("#boot-current")!.textContent = message;
}
export function mountLoadingScreen() {
  startup.begin();
  const queue = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  unsubscribe = startup.subscribe(queue);
  document
    .querySelector("#boot-retry")!
    .addEventListener("click", () => location.reload());
  patience = setTimeout(
    () =>
      showRecovery(
        "Loading is taking longer than usual. You can wait, or retry if your connection was interrupted.",
      ),
    25000,
  );
  queue();
}
export function failLoading() {
  clearTimeout(patience);
  const root = document.querySelector<HTMLElement>("#boot-screen");
  if (!root) return;
  root.dataset.failed = "true";
  root.setAttribute("aria-busy", "false");
  showRecovery(
    "Some game files could not load. Check your connection and retry. Your saved progress is safe.",
  );
  paint();
}
export function finishLoading() {
  startup.finish();
  cancelAnimationFrame(frame);
  paint();
  clearTimeout(patience);
  unsubscribe?.();
  const root = document.querySelector<HTMLElement>("#boot-screen");
  if (!root) return;
  root.setAttribute("aria-busy", "false");
  root.hidden = true;
  document.body.classList.remove("is-loading");
  document.querySelector<HTMLElement>("#app")!.inert = false;
  document.querySelector("#app")!.removeAttribute("aria-hidden");
}
