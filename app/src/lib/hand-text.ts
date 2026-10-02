/** Identify the writer of each transcription text node, including continuations
 * without a new hand-start marker. Editorial notes do not identify a writer. */
export function handTextNodes(root: HTMLElement, baseRef: string | undefined) {
  const texts: { node: Text; ref: string }[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim()) continue;
    const parent = node.parentElement!;
    if (parent.closest('.note, .sidenote-slot, .inpos-note, .hand-range-background')) continue;
    const ref = parent.closest<HTMLElement>('.hand')?.dataset.ref || baseRef;
    if (ref) texts.push({ node: node as Text, ref });
  }
  return texts;
}
