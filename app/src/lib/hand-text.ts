/** Identify the writer of each transcription text node, including continuations
 * without a new hand-start marker. Editorial notes do not identify a writer. */
export function handTextNodes(root: HTMLElement, baseRef: string | undefined) {
  return [...handTextNodeEntries(root, baseRef)];
}

/** Print preparation consumes entries directly, avoiding an intermediate list.
 * Adjacent text nodes often share a parent; cache its two ancestry lookups. */
export function* handTextNodeEntries(root: HTMLElement, baseRef: string | undefined) {
  const refs = new WeakMap<HTMLElement, string | undefined>();
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim()) continue;
    const parent = node.parentElement!;
    if (!refs.has(parent)) {
      refs.set(parent, parent.closest('.note, .sidenote-slot, .inpos-note, .hand-range-background')
        ? undefined : parent.closest<HTMLElement>('.hand')?.dataset.ref || baseRef);
    }
    const ref = refs.get(parent);
    if (ref) yield { node: node as Text, ref };
  }
}
