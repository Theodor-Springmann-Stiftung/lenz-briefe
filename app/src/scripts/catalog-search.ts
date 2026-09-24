import {normalizeSearch, prepareSearch, searchBlocks, searchPreview, matchPages} from '../lib/search.mjs';

interface SearchBlock { letter: string; kind: 'text' | 'sidenote' | 'tradition'; anchor: string; text: string; label?: string; pages?: [number, string][] }
type IndexedBlock = SearchBlock & {normalized: string};

export function createCatalogSearch(rows: Map<string | undefined, HTMLElement>, changed: () => void) {
  const input = document.querySelector<HTMLInputElement>('#letter-search')!;
  const results = document.querySelector<HTMLElement>('.search-results')!;
  const status = document.querySelector<HTMLElement>('#search-status')!;
  const feedback = document.querySelector<HTMLElement>('.search-feedback')!;
  const retry = document.querySelector<HTMLButtonElement>('.search-retry')!;
  const spinner = document.querySelector<HTMLElement>('.search-spinner')!;
  const groups = [...results.querySelectorAll<HTMLElement>('[data-search-section]')];
  let index: IndexedBlock[] | null = null;
  let request: Promise<void> | null = null;
  let phase: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  let cachedQuery = '', cachedHits: IndexedBlock[] = [];
  let viewKey = '';
  const limits = new Map(groups.map(group => [group, 20]));

  function load() {
    if (request || index || phase === 'error') return;
    phase = 'loading';
    request = (async () => {
      try {
        const response = await fetch(input.dataset.searchIndex!);
        if (!response.ok) throw new Error('Search download failed');
        const data = await response.json();
        if (data.version !== 1 || !Array.isArray(data.blocks)) throw new Error('Invalid search index');
        index = prepareSearch(data.blocks);
        phase = 'ready';
      } catch {
        phase = 'error';
      } finally {
        request = null;
        changed();
      }
    })();
  }

  input.addEventListener('focus', () => { load(); changed(); });
  retry.addEventListener('click', () => { phase = 'idle'; load(); changed(); });
  for (const group of groups) {
    group.querySelector('.search-more')!.addEventListener('click', () => {
      limits.set(group, limits.get(group)! + 20);
      changed();
    });
  }

  function find(query: string): IndexedBlock[] | null {
    if (!normalizeSearch(query)) return [];
    load();
    if (!index) return null;
    const normalized = normalizeSearch(query);
    if (normalized !== cachedQuery) {
      cachedQuery = normalized;
      cachedHits = searchBlocks(index, query);
    }
    return cachedHits;
  }

  function render(query: string, hits: IndexedBlock[] | null, orderedIds: string[]) {
    const active = Boolean(query.trim());
    results.hidden = !active;
    results.setAttribute('aria-busy', String(phase === 'loading'));
    spinner.hidden = phase !== 'loading';
    input.setAttribute('aria-busy', String(phase === 'loading'));
    retry.hidden = phase !== 'error';
    feedback.hidden = !active && phase !== 'loading' && phase !== 'error';
    feedback.classList.toggle('sr-only', phase === 'loading' || (active && Boolean(normalizeSearch(query)) && phase === 'ready'));
    if (phase === 'loading') status.textContent = 'Suchindex wird geladen …';
    else if (phase === 'error') status.textContent = 'Der Suchindex konnte nicht geladen werden.';
    else if (active && !normalizeSearch(query)) status.textContent = 'Bitte ergänzen Sie Ihren Suchbegriff.';
    else status.textContent = '';

    const key = JSON.stringify([query, orderedIds]);
    if (key !== viewKey) {
      viewKey = key;
      groups.forEach(group => limits.set(group, 20));
    }
    let total = 0;
    const matchedLetters = new Set<string>();
    for (const group of groups) {
      group.hidden = !active || !hits || !normalizeSearch(query);
      if (group.hidden) continue;
      const traditions = group.dataset.searchSection === 'tradition';
      const byLetter = new Map<string, IndexedBlock[]>();
      for (const hit of hits!) {
        if ((hit.kind === 'tradition') !== traditions) continue;
        if (!byLetter.has(hit.letter)) byLetter.set(hit.letter, []);
        byLetter.get(hit.letter)!.push(hit);
      }
      const ids = orderedIds.filter(id => byLetter.has(id));
      const count = ids.reduce((n, id) => n + byLetter.get(id)!.length, 0);
      total += count;
      ids.forEach(id => matchedLetters.add(id));
      group.querySelector('.search-section-count')!.textContent = `${count} ${count === 1 ? 'Fundstelle' : 'Fundstellen'} · ${ids.length} ${ids.length === 1 ? 'Brief' : 'Briefe'}`;
      group.querySelector<HTMLElement>('.search-empty')!.hidden = count > 0;
      const fragment = document.createDocumentFragment();
      for (const id of ids.slice(0, limits.get(group))) {
        const row = rows.get(id)!;
        const item = document.createElement('li');
        item.dataset.searchLetter = id;
        const header = row.querySelector('.letter-header')!.cloneNode(true) as HTMLElement;
        const oldHeading = header.querySelector('h2')!;
        const heading = document.createElement('h3');
        heading.className = oldHeading.className;
        heading.append(...oldHeading.childNodes);
        oldHeading.replaceWith(heading);
        header.querySelectorAll<HTMLElement>('[data-tooltip]').forEach(element => {
          element.title = element.dataset.tooltip!;
          element.removeAttribute('aria-describedby');
        });
        item.append(header);
        const previews = document.createElement('ul');
        previews.className = 'search-previews';
        const url = row.querySelector<HTMLAnchorElement>('.letter-card-link')!.getAttribute('href')!;
        for (const hit of byLetter.get(id)!) {
          const preview = document.createElement('li');
          const link = document.createElement('a');
          link.className = 'search-hit';
          link.href = `${url}#${hit.anchor}`;
          const label = document.createElement('span');
          label.className = 'search-hit-label';
          const pages = matchPages(hit, query) as string[];
          const consecutive = pages.every((page, i) => i === 0 || Number(page) === Number(pages[i - 1]) + 1);
          const pageLabel = pages.length ? `S. ${pages.length > 1 && consecutive ? `${pages[0]}–${pages.at(-1)}` : pages.join(', ')}` : '';
          if (hit.kind === 'tradition') {
            label.textContent = hit.label || 'Überlieferungsdaten';
            if (pageLabel) {
              const page = document.createElement('span');
              page.className = 'search-hit-pages';
              page.textContent = pageLabel;
              label.append(page);
            }
          } else {
            label.textContent = pageLabel || '•';
            if (!pageLabel) label.setAttribute('aria-hidden', 'true');
          }
          const text = document.createElement('span');
          text.className = 'search-hit-text';
          if (hit.kind === 'sidenote') {
            const context = document.createElement('span');
            context.className = 'search-hit-context';
            context.textContent = 'Randnotiz · ';
            text.append(context);
          }
          for (const part of searchPreview(hit.text, query)) {
            if (part.match) {
              const mark = document.createElement('mark');
              mark.textContent = part.text;
              text.append(mark);
            } else text.append(document.createTextNode(part.text));
          }
          link.append(label, text);
          preview.append(link);
          previews.append(preview);
        }
        item.append(previews);
        fragment.append(item);
      }
      group.querySelector('.search-letter-list')!.replaceChildren(fragment);
      group.querySelector<HTMLElement>('.search-more')!.hidden = ids.length <= limits.get(group)!;
    }
    if (active && hits && normalizeSearch(query) && phase === 'ready') {
      status.textContent = `${total} ${total === 1 ? 'Fundstelle' : 'Fundstellen'} in ${matchedLetters.size} ${matchedLetters.size === 1 ? 'Brief' : 'Briefen'}`;
    }
  }
  return {find, render};
}
