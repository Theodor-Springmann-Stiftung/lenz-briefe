import {matchRanges} from '../lib/search.mjs';

/** Highlight across inline markup without replacing the existing elements. */
export function highlightText(target: HTMLElement, query: string) {
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  const nodes: {node: Text; start: number; end: number}[] = [];
  let text = '';
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest('script, style, [aria-hidden="true"], .sr-only')) continue;
    const start = text.length;
    text += node.data;
    nodes.push({node, start, end: text.length});
  }
  const ranges: {start: number; end: number}[] = matchRanges(text, query);
  for (const {node, start, end} of nodes) {
    for (const range of [...ranges].reverse()) {
      const from = Math.max(start, range.start) - start;
      const to = Math.min(end, range.end) - start;
      if (from >= to) continue;
      if (to < node.length) node.splitText(to);
      const match = from > 0 ? node.splitText(from) : node;
      const mark = document.createElement('mark');
      mark.className = 'search-match';
      match.replaceWith(mark);
      mark.append(match);
    }
  }
}
