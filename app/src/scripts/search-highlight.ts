import {matchRanges, normalizeSearch} from '../lib/search.mjs';

function highlightSearchTarget() {
  document.querySelectorAll('mark.search-match').forEach(mark => {
    const parent = mark.parentNode!;
    mark.replaceWith(...mark.childNodes);
    parent.normalize();
  });
  const query = new URLSearchParams(location.search).get('q') || '';
  const active = Boolean(normalizeSearch(query));
  document.documentElement.classList.toggle('search-highlight-active', active);
  if (!active || !location.hash) return;
  let id: string;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (!target?.closest('.edition-text')) return;

  // Match across inline markup, then wrap each text fragment separately so
  // italics, deletions, links and other editorial formatting stay intact.
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  const nodes: {node: Text; start: number; end: number}[] = [];
  let text = '';
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest('script, style, [aria-hidden="true"]')) continue;
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

highlightSearchTarget();
window.addEventListener('hashchange', () => {
  highlightSearchTarget();
  document.querySelector('.search-match')?.scrollIntoView({block: 'start'});
});
