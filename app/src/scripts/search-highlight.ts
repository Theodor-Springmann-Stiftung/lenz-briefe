import {normalizeSearch} from '../lib/search.mjs';
import {highlightText} from './highlight-text';
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
  const metadata = match.closest<HTMLElement>('[data-search-target]');
  if (metadata) {
    const bounds = metadata.getBoundingClientRect();
    const edge = Math.min(sidebar.right, bounds.left - 16);
    const available = edge - Math.max(8, sidebar.left);
    if (available >= 100) {
      dismissButton.style.maxWidth = `${available}px`;
      dismissButton.style.left = `${edge + scrollX - dismissButton.offsetWidth}px`;
      dismissButton.style.top = `${center + scrollY - dismissButton.offsetHeight / 2}px`;
    } else {
      // The header can extend into the text margin; keep the pill above it.
      dismissButton.style.maxWidth = `${bounds.width}px`;
      dismissButton.style.left = `${bounds.left + scrollX}px`;
      dismissButton.style.top = `${bounds.top + scrollY - dismissButton.offsetHeight - 12}px`;
    }
    return;
  }
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
  if (!target?.closest('.edition-text, [data-search-target]')) return;

  highlightText(target, query);
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
