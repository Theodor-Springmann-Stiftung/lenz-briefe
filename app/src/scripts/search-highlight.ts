import {matchRanges, normalizeSearch} from '../lib/search.mjs';
import filterOffIcon from 'remixicon/icons/System/filter-off-line.svg?raw';
import searchIcon from 'remixicon/icons/System/search-line.svg?raw';

let dismissButton: HTMLButtonElement | null = null;

function positionDismissButton() {
  if (!dismissButton) return;
  const match = document.querySelector<HTMLElement>('mark.search-match');
  if (!match) return;
  const desktop = matchMedia('(min-width: 1100px)').matches;
  if (!desktop) {
    dismissButton.hidden = false;
    dismissButton.style.top = '';
    dismissButton.style.left = '';
    dismissButton.style.maxWidth = '';
    return;
  }
  const layout = document.querySelector('.reading-layout');
  if (!layout?.classList.contains('margins-visible')) {
    dismissButton.hidden = true;
    return;
  }
  const pageMargin = document.querySelector('.page-margin')!;
  const sidebar = pageMargin.getBoundingClientRect();
  const rect = match.getClientRects()[0] || match.getBoundingClientRect();
  dismissButton.hidden = false;
  dismissButton.style.maxWidth = `${sidebar.width}px`;
  const center = rect.top + rect.height / 2;
  let right = sidebar.right;
  // Keep the highlight's vertical position; reserve horizontal room for numbers.
  const numbers = [...pageMargin.querySelectorAll('.page-number a')].map(number => number.getBoundingClientRect());
  for (let pass = 0; pass <= numbers.length; pass++) {
    const top = center - dismissButton.offsetHeight / 2;
    const bottom = top + dismissButton.offsetHeight + 4;
    const nextRight = Math.min(right, ...numbers
      .filter(bounds => top < bounds.bottom + 6 && bottom > bounds.top - 6)
      .map(bounds => bounds.left - 12));
    if (nextRight === right) break;
    right = nextRight;
    dismissButton.style.maxWidth = `${Math.max(1, right - Math.max(8, sidebar.left))}px`;
  }
  dismissButton.style.left = `${Math.max(8, right + scrollX - dismissButton.offsetWidth)}px`;
  dismissButton.style.top = `${center + scrollY - dismissButton.offsetHeight / 2}px`;
}

function highlightSearchTarget() {
  // replaceState clears the URL fragment without necessarily clearing :target.
  document.documentElement.classList.toggle('has-letter-fragment', Boolean(location.hash));
  dismissButton?.remove();
  dismissButton = null;
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
  if (document.querySelector('mark.search-match')) {
    dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'filter-pill search-highlight-dismiss';
    for (const [icon, className] of [[searchIcon, 'filter-pill-icon'], [filterOffIcon, 'filter-pill-remove']]) {
      const span = document.createElement('span');
      span.className = `ui-icon ${className}`;
      span.setAttribute('aria-hidden', 'true');
      span.innerHTML = icon;
      dismissButton.append(span);
    }
    const label = document.createElement('span');
    label.className = 'filter-pill-name';
    label.textContent = `Suche: »${query.trim()}«`;
    dismissButton.append(label);
    dismissButton.title = 'Suchmarkierung entfernen';
    dismissButton.setAttribute('aria-label', `${label.textContent} – Suchmarkierung entfernen`);
    dismissButton.hidden = true;
    dismissButton.addEventListener('click', () => {
      const url = new URL(location.href);
      url.searchParams.delete('q');
      url.hash = '';
      history.replaceState(history.state, '', url);
      highlightSearchTarget();
    });
    document.body.append(dismissButton);
    positionDismissButton();
  }
}

highlightSearchTarget();
window.addEventListener('hashchange', () => {
  highlightSearchTarget();
  document.querySelector('.search-match')?.scrollIntoView({block: 'start'});
});
window.addEventListener('popstate', highlightSearchTarget);
window.addEventListener('resize', positionDismissButton);
document.addEventListener('margins:arranged', positionDismissButton);
document.fonts.ready.then(positionDismissButton);
