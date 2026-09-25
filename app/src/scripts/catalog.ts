import {readState, matches, queryFor, orderedRecords, hasFilters, withFilters, removeFilter, resetFilters, selectReferenceFilter, normalizeYearGroup} from '../lib/filters.mjs';
import {createCatalogSearch} from './catalog-search';
const data = JSON.parse(document.querySelector('#filter-data')!.textContent!);
let state = readState(location.search, data.records, data.groups);
const rows = new Map([...document.querySelectorAll<HTMLElement>('[data-letter]')].map(e => [e.dataset.letter, e]));
const checkboxes = [...document.querySelectorAll<HTMLInputElement>('.filter-options input')];
const list = document.querySelector<HTMLOListElement>('.catalog-letter-list')!;
const referenceLinks = [...list.querySelectorAll<HTMLAnchorElement>('.reference-filter')];
const activeFilters = document.querySelector<HTMLElement>('.active-filters')!;
const pills = document.querySelector<HTMLElement>('.active-filter-pills')!;
const allLettersLink = document.querySelector<HTMLButtonElement>('.all-letters-link')!;
const searchInput = document.querySelector<HTMLInputElement>('#letter-search')!;
searchInput.value = state.q || '';
const search = createCatalogSearch(rows, () => render());
function renderFilterPills() {
  activeFilters.hidden = !hasFilters(state);
  allLettersLink.hidden = !hasFilters(state);
  const fragment = document.createDocumentFragment();
  for (const kind of ['person', 'place', 'search'] as const) {
    const template = document.querySelector<HTMLTemplateElement>(`#filter-pill-${kind}`)!;
    const selected = kind === 'search' ? (state.q?.trim() ? [state.q] : []) : kind === 'person' ? state.people : state.places;
    for (const id of selected) {
      const name = kind === 'search' ? `Suche: „${id.trim()}“`
        : checkboxes.find(input => input.name === kind && input.value === id)!.closest('label')!.querySelector('span')!.textContent!;
      const pill = template.content.firstElementChild!.cloneNode(true) as HTMLButtonElement;
      pill.dataset.filterId = id;
      pill.querySelector('.filter-pill-name')!.textContent = name;
      const label = kind === 'search' ? `Suche entfernen: ${id.trim()}`
        : `${kind === 'person' ? 'Personenfilter' : 'Ortsfilter'} entfernen: ${name}`;
      pill.setAttribute('aria-label', label);
      pill.title = label;
      fragment.append(pill);
    }
  }
  pills.replaceChildren(fragment);
}
function render() {
  document.dispatchEvent(new Event('catalog:change'));
  const query = state.q || '';
  const searching = Boolean(query.trim());
  const hits = searching ? search.find(query) : null;
  const matchingIds = hits ? new Set(hits.map(hit => hit.letter)) : null;
  const matchesSearch = (id: string) => !searching || matchingIds === null || matchingIds.has(id);
  list.hidden = searching;
  let count = 0;
  for (const record of data.records) {
    const visible = matches(record, state) && matchesSearch(record.id);
    rows.get(record.id)!.hidden = !visible;
    if (visible) count++;
  }
  const ordered = document.createDocumentFragment();
  orderedRecords(data.records, state.sort).forEach((record: {id: string}) => ordered.append(rows.get(record.id)!));
  list.append(ordered);
  document.querySelector('#result-count')!.textContent = searching && hits === null ? '—' : `${count} ${count === 1 ? 'Brief' : 'Briefe'}`;
  document.querySelector<HTMLElement>('.empty-state')!.hidden = searching || count > 0;
  renderFilterPills();
  referenceLinks.forEach(link => {
    link.href = `${location.pathname}?${queryFor(selectReferenceFilter(state, link.dataset.referenceKind!, link.dataset.referenceId!))}`;
  });
  checkboxes.forEach(input => input.checked = (input.name === 'person' ? state.people : state.places).includes(input.value));
  for (const kind of ['person', 'place']) {
    const count = (kind === 'person' ? state.people : state.places).length;
    const badge = document.querySelector<HTMLElement>(`[data-selected-count="${kind}"]`)!;
    badge.hidden = count === 0;
    badge.textContent = String(count);
    badge.setAttribute('aria-label', `${count} ausgewählt`);
  }
  document.querySelectorAll<HTMLAnchorElement>('[data-group]').forEach(link => {
    const group = link.dataset.group!;
    link.hidden = group === 'all' ? !hasFilters(state) : hasFilters(state);
    const next = {...state, group};
    const count = data.records.filter((r: any) => matches(r, next) && matchesSearch(r.id)).length;
    if (link.hidden || (group !== 'all' && count === 0)) {
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('role', 'link');
      link.tabIndex = -1;
      link.removeAttribute('href');
    } else {
      link.removeAttribute('aria-disabled');
      link.removeAttribute('role');
      link.removeAttribute('tabindex');
      link.href = `${location.pathname}?${queryFor(next)}`;
    }
    if (group === state.group) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  search.render(query, hits, orderedRecords(data.records, state.sort).filter((record: any) => matches(record, state)).map((record: any) => record.id));
}
function navigate(next: typeof state, replace = false) {
  clearTimeout(searchTimer);
  state = normalizeYearGroup(next, data.groups);
  searchInput.value = state.q || '';
  const query = queryFor(state);
  const url = `${location.pathname}${query ? '?' + query : ''}`;
  if (url !== location.pathname + location.search) history[replace ? 'replaceState' : 'pushState'](null, '', url);
  render();
}
checkboxes.forEach(input => input.addEventListener('change', () => navigate(withFilters(
  state,
  checkboxes.filter(i => i.name === 'person' && i.checked).map(i => i.value),
  checkboxes.filter(i => i.name === 'place' && i.checked).map(i => i.value),
))));
document.querySelector('.catalog-section')!.addEventListener('click', event => {
  const link = (event.target as Element).closest<HTMLAnchorElement>('.reference-filter');
  if (!link) return;
  const mouse = event as MouseEvent;
  if (mouse.button !== 0 || mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return;
  event.preventDefault();
  navigate(selectReferenceFilter(state, link.dataset.referenceKind!, link.dataset.referenceId!));
});
let searchTimer: ReturnType<typeof setTimeout>;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const query = searchInput.value;
    const next = {...state, ...(!state.q && query.trim() ? {group: 'all'} : {})};
    if (query.trim()) next.q = query; else delete next.q;
    navigate(next, Boolean(state.q) === Boolean(query));
  }, 100);
});
document.querySelectorAll<HTMLAnchorElement>('[data-group]').forEach(link => link.addEventListener('click', event => {
  if (link.hidden || link.getAttribute('aria-disabled') === 'true') {event.preventDefault(); return;}
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); navigate({...state, group:link.dataset.group!});
}));
pills.addEventListener('click', event => {
  const pill = (event.target as Element).closest<HTMLButtonElement>('.filter-pill');
  if (!pill) return;
  const index = [...pills.querySelectorAll('.filter-pill')].indexOf(pill);
  const kind = pill.dataset.filterKind!;
  navigate(removeFilter(state, kind, pill.dataset.filterId!));
  const remaining = [...pills.querySelectorAll<HTMLButtonElement>('.filter-pill')];
  const nextFocus = remaining[Math.min(index, remaining.length - 1)]
    || (kind === 'search' ? searchInput : document.querySelector<HTMLElement>(`[data-filter-menu="${kind}"] summary`)!);
  nextFocus.focus();
});
document.querySelector('[data-reset]')!.addEventListener('click', () => navigate(resetFilters(state)));
allLettersLink.addEventListener('click', () => navigate(resetFilters(state)));
document.querySelectorAll<HTMLInputElement>('[data-option-search]').forEach(input => input.addEventListener('input', () => {
  const value = input.value.toLocaleLowerCase('de');
  const options = [...document.querySelectorAll<HTMLElement>(`[data-option="${input.dataset.optionSearch}"]`)];
  options.forEach(option => option.hidden = !option.dataset.name!.includes(value));
  const noMatches = options.every(option => option.hidden);
  const panel = input.closest('.filter-panel')!;
  panel.querySelector<HTMLElement>('.filter-options')!.hidden = noMatches;
  panel.querySelector<HTMLElement>('[data-option-empty]')!.hidden = !noMatches;
}));
document.addEventListener('click', event => {
  document.querySelectorAll<HTMLDetailsElement>('[data-filter-menu]').forEach(menu => {if (!menu.contains(event.target as Node)) menu.open = false;});
});
document.addEventListener('keydown', event => {if (event.key === 'Escape') document.querySelectorAll<HTMLDetailsElement>('[data-filter-menu]').forEach(menu => menu.open = false);});
window.addEventListener('popstate', () => {
  clearTimeout(searchTimer);
  state = readState(location.search, data.records, data.groups);
  searchInput.value = state.q || '';
  render();
});
// Canonicalize unknown query values once without adding a history entry.
const query = queryFor(state);
history.replaceState(null, '', `${location.pathname}${query ? '?' + query : ''}${location.hash}`);
render();
