/** One shared hover tooltip for any element with a data-tooltip key. */
export function installTooltips(
  root: HTMLElement,
  render: (key: string) => string,
) {
  const tip = document.createElement("div");
  tip.className = "game-tooltip hidden";
  tip.setAttribute("role", "tooltip");
  tip.id = "game-tooltip";
  root.append(tip);
  let anchor: HTMLElement | null = null;
  const place = () => {
    if (!anchor) return;
    const box = anchor.getBoundingClientRect(),
      size = tip.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(
        innerWidth - size.width - 8,
        box.left + box.width / 2 - size.width / 2,
      ),
    );
    const above = box.top - size.height - 10;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, Math.min(innerHeight - size.height - 8, above > 8 ? above : box.bottom + 10))}px`;
  };
  const hide = () => {
    anchor?.removeAttribute("aria-describedby");
    anchor = null;
    tip.classList.add("hidden");
  };
  const show = (target: EventTarget | null) => {
    const next = (target as Element | null)?.closest<HTMLElement>(
      "[data-tooltip]",
    );
    if (next === anchor) return;
    if (!next) return hide();
    const markup = render(next.dataset.tooltip!);
    if (!markup) return hide();
    anchor?.removeAttribute("aria-describedby");
    anchor = next;
    anchor.setAttribute("aria-describedby", tip.id);
    tip.innerHTML = markup;
    tip.classList.remove("hidden");
    place();
  };
  root.addEventListener("pointerover", (event) => show(event.target));
  root.addEventListener("focusin", (event) => show(event.target));
  root.addEventListener("focusout", hide);
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });
  root.addEventListener("pointerleave", hide);
  return {
    /** Re-render the open tooltip, for example when a slot unlocks. */
    refresh() {
      if (!anchor) return;
      if (!anchor.isConnected) return hide();
      tip.innerHTML = render(anchor.dataset.tooltip!);
      place();
    },
    hide,
  };
}
