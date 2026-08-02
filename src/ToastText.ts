/*
  Shared "plain text, but line breaks are still honored" renderer. Splits on
  a real newline or a literal "<br>"/"<br/>" and rejoins with actual <br>
  elements between text nodes — nothing else in `text` is ever parsed as
  markup. Used everywhere a field is documented as plain text but still
  supports line breaks without opting into full HTML: message content,
  title, detail label/value, and button/step labels (top-level buttons,
  details toggle, step buttons).

  `allowLineBreaks: false` (see `ToastOptions.allowLineBreaks`) skips the
  split entirely and renders `text` as one inert text node — "\n"/"<br>"
  stop being special-cased, same as any other character.
*/
export function renderTextWithBreaks(container: Element, text: string, allowLineBreaks: boolean = true): void {
    if (!text) return;
    if (!allowLineBreaks) {
        container.appendChild(document.createTextNode(text));
        return;
    }
    const parts = text.split(/\r\n|\r|\n|<br\s*\/?>/gi);
    parts.forEach((part, i) => {
        if (i > 0) container.appendChild(document.createElement('br'));
        if (part) container.appendChild(document.createTextNode(part));
    });
}
