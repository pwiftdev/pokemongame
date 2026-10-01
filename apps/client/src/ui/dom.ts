const rendered = new WeakMap<Element, string>();

export function updateMarkup(element: Element, markup: string) {
  if (rendered.get(element) === markup) return;
  element.innerHTML = markup;
  rendered.set(element, markup);
}

export function preservePanel(root: Element) {
  const scroll = root.querySelector(".panel-body")?.scrollTop ?? 0;
  const scrollAreas = new Map(
    [...root.querySelectorAll<HTMLElement>("[data-panel-scroll]")].map(
      (element) => [element.dataset.panelScroll, element.scrollTop],
    ),
  );
  const focused = document.activeElement as HTMLElement | null;
  const attribute = focused?.hasAttribute("data-focus")
    ? "data-focus"
    : "data-action";
  const key = root.contains(focused) ? focused?.getAttribute(attribute) : null;
  const opened = [
    ...root.querySelectorAll<HTMLDetailsElement>("details[data-detail][open]"),
  ].map((element) => element.dataset.detail);
  return () => {
    for (const element of root.querySelectorAll<HTMLDetailsElement>(
      "details[data-detail]",
    ))
      element.open = opened.includes(element.dataset.detail);
    const body = root.querySelector(".panel-body");
    if (body) body.scrollTop = scroll;
    for (const element of root.querySelectorAll<HTMLElement>(
      "[data-panel-scroll]",
    ))
      element.scrollTop = scrollAreas.get(element.dataset.panelScroll) ?? 0;
    if (key)
      root
        .querySelector<HTMLElement>(`[${attribute}="${CSS.escape(key)}"]`)
        ?.focus({ preventScroll: true });
  };
}
