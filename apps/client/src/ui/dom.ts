const rendered = new WeakMap<Element, string>();

export function updateMarkup(element: Element, markup: string) {
  if (rendered.get(element) === markup) return;
  element.innerHTML = markup;
  rendered.set(element, markup);
}
