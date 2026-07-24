/*
  Shared "plain text, but line breaks are still honored" renderer. Splits on
  a real newline or a literal "<br>"/"<br/>" and rejoins with actual <br>
  elements between text nodes — nothing else in `text` is ever parsed as
  markup. Used everywhere a field is documented as plain text but still
  supports line breaks without opting into full HTML: message content,
  title, and button/step labels (top-level buttons, details toggle, step
  buttons).
*/
export function renderTextWithBreaks(container: Element, text: string): void {
    const parts = text.split(/\r\n|\r|\n|<br\s*\/?>/gi);
    parts.forEach((part, i) => {
        if (i > 0) container.appendChild(document.createElement('br'));
        if (part) container.appendChild(document.createTextNode(part));
    });
}
