import {
  readState,
  matches,
  queryFor,
  orderedRecords,
  hasFilters,
  withFilters,
  removeFilter,
  resetFilters,
  normalizeYearGroup,
} from '../lib/filters.mjs';
import { createCatalogSearch } from './catalog-search';
import { setupSelectionPrint } from './print-selection';
import { selectionDescription } from '../lib/print-selection.mjs';
import { createFilterOptionOrder } from '../lib/filter-option-order.mjs';
const data = JSON.parse(document.querySelector('#filter-data')!.textContent!);
let state = readState(location.search, data.records, data.groups);
const rows = new Map(
  [...document.querySelectorAll<HTMLElement>('[data-letter]')].map((e) => [e.dataset.letter, e]),
);
const checkboxes = [...document.querySelectorAll<HTMLInputElement>('.filter-options input')];
const refreshFilterMenus: (() => void)[] = [];
const list = document.querySelector<HTMLOListElement>('.catalog-letter-list')!;
const activeFilters = document.querySelector<HTMLElement>('.active-filters')!;
const pills = document.querySelector<HTMLElement>('.active-filter-pills')!;
const informationCards = document.querySelector<HTMLElement>('.filter-information')!;
const informationTemplates = new Map(
  [...document.querySelectorAll<HTMLTemplateElement>('[data-filter-information]')]
    .map((template) => [template.dataset.filterInformation!, template]),
);
const allLettersLink = document.querySelector<HTMLButtonElement>('.all-letters-link')!;
const searchInput = document.querySelector<HTMLInputElement>('#letter-search')!;
searchInput.value = state.q || '';
const search = createCatalogSearch(rows, () => render());
function renderFilterPills() {
  activeFilters.hidden = !hasFilters(state);
  allLettersLink.hidden = !hasFilters(state);
  const fragment = document.createDocumentFragment();
  const cards = document.createDocumentFragment();
  for (const kind of ['person', 'place', 'search'] as const) {
    const template = document.querySelector<HTMLTemplateElement>(`#filter-pill-${kind}`)!;
    const selected =
      kind === 'search'
        ? state.q?.trim()
          ? [state.q]
          : []
        : kind === 'person'
          ? state.people
          : state.places;
    for (const id of selected) {
      const name =
        kind === 'search'
          ? `Suche: »${id.trim()}«`
          : checkboxes
              .find((input) => input.name === kind && input.value === id)!
              .closest('label')!
              .querySelector('span')!.textContent!;
      const pill = template.content.firstElementChild!.cloneNode(true) as HTMLButtonElement;
      pill.querySelector('.filter-pill-name')!.textContent = name;
      pill.dataset.filterId = id;
      const label =
        kind === 'search'
          ? `Suche entfernen: ${id.trim()}`
          : `${kind === 'person' ? 'Personenfilter' : 'Ortsfilter'} entfernen: ${name}`;
      pill.setAttribute('aria-label', label);
      pill.title = label;
      const information = informationTemplates.get(`${kind}-${id}`);
      if (information) {
        cards.append(information.content.cloneNode(true));
      }
      fragment.append(pill);
    }
  }
  pills.replaceChildren(fragment);
  informationCards.replaceChildren(cards);
  informationCards.hidden = !informationCards.childElementCount;
}
function render() {
  document.dispatchEvent(new Event('catalog:change'));
  const query = state.q || '';
  const searching = Boolean(query.trim());
  const hits = searching ? search.find(query) : null;
  const matchingIds = hits ? new Set(hits.map((hit) => hit.letter)) : null;
  const matchesSearch = (id: string) => !searching || matchingIds === null || matchingIds.has(id);
  list.hidden = searching;
  let count = 0;
  for (const record of data.records) {
    const visible = matches(record, state) && matchesSearch(record.id);
    rows.get(record.id)!.hidden = !visible;
    if (visible) count++;
  }
  const ordered = document.createDocumentFragment();
  orderedRecords(data.records, state.sort).forEach((record: { id: string }) =>
    ordered.append(rows.get(record.id)!),
  );
  list.append(ordered);
  document.querySelector('#result-count')!.textContent =
    searching && hits === null ? '—' : `${count} ${count === 1 ? 'Brief' : 'Briefe'}`;
  document.querySelector<HTMLElement>('.empty-state')!.hidden = searching || count > 0;
  document.querySelector<HTMLElement>('.selection-print-tools')!.hidden = searching || count === 0;
  renderFilterPills();
  checkboxes.forEach(
    (input) =>
      (input.checked = (input.name === 'person' ? state.people : state.places).includes(
        input.value,
      )),
  );
  refreshFilterMenus.forEach((refresh) => refresh());
  for (const kind of ['person', 'place']) {
    const count = (kind === 'person' ? state.people : state.places).length;
    const badge = document.querySelector<HTMLElement>(`[data-selected-count="${kind}"]`)!;
    badge.hidden = count === 0;
    badge.textContent = String(count);
    badge.setAttribute('aria-label', `${count} ausgewählt`);
  }
  document.querySelectorAll<HTMLAnchorElement>('[data-group]').forEach((link) => {
    const group = link.dataset.group!;
    link.hidden = group === 'all' ? !hasFilters(state) : hasFilters(state);
    const next = { ...state, group };
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
    if (group === state.group) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  search.render(
    query,
    hits,
    orderedRecords(data.records, state.sort)
      .filter((record: any) => matches(record, state))
      .map((record: any) => record.id),
  );
}
function navigate(next: typeof state, replace = false) {
  clearTimeout(searchTimer);
  state = normalizeYearGroup(next, data.groups);
  searchInput.value = state.q || '';
  const query = queryFor(state);
  const url = `${location.pathname}${query ? '?' + query : ''}`;
  if (url !== location.pathname + location.search)
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
  render();
}
checkboxes.forEach((input) =>
  input.addEventListener('change', () =>
    navigate(
      withFilters(
        state,
        checkboxes.filter((i) => i.name === 'person' && i.checked).map((i) => i.value),
        checkboxes.filter((i) => i.name === 'place' && i.checked).map((i) => i.value),
      ),
    ),
  ),
);
let searchTimer: ReturnType<typeof setTimeout>;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const query = searchInput.value;
    const next = { ...state, ...(!state.q && query.trim() ? { group: 'all' } : {}) };
    if (query.trim()) next.q = query;
    else delete next.q;
    navigate(next, Boolean(state.q) === Boolean(query));
  }, 100);
});
document.querySelectorAll<HTMLAnchorElement>('[data-group]').forEach((link) =>
  link.addEventListener('click', (event) => {
    if (link.hidden || link.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate({ ...state, group: link.dataset.group! });
  }),
);
pills.addEventListener('click', (event) => {
  const pill = (event.target as Element).closest<HTMLButtonElement>('.filter-pill');
  if (!pill) return;
  const index = [...pills.querySelectorAll('.filter-pill')].indexOf(pill);
  const kind = pill.dataset.filterKind!;
  navigate(removeFilter(state, kind, pill.dataset.filterId!));
  const remaining = [...pills.querySelectorAll<HTMLButtonElement>('.filter-pill')];
  const nextFocus =
    remaining[Math.min(index, remaining.length - 1)] ||
    (kind === 'search'
      ? searchInput
      : document.querySelector<HTMLElement>(`[data-filter-menu="${kind}"] summary`)!);
  nextFocus.focus();
});
document
  .querySelector('[data-reset]')!
  .addEventListener('click', () => navigate(resetFilters(state)));
allLettersLink.addEventListener('click', () => navigate(resetFilters(state)));
document.querySelectorAll<HTMLInputElement>('[data-option-search]').forEach((input) => {
  const menu = input.closest<HTMLDetailsElement>('[data-filter-menu]')!;
  const panel = input.closest('.filter-panel')!;
  const container = panel.querySelector<HTMLElement>('.filter-options')!;
  const options = [...container.querySelectorAll<HTMLElement>('[data-option]')];
  const orderOptions = createFilterOptionOrder(options);
  let currentOrder = options;
  let promoted = new Set<HTMLElement>();
  const updateDivider = () => {
    const visible = currentOrder.filter((option) => !option.hidden);
    const lastPromoted = visible.filter((option) => promoted.has(option)).at(-1);
    const hasRest = visible.some((option) => !promoted.has(option));
    options.forEach((option) => option.classList.toggle('filter-options-divider', hasRest && option === lastPromoted));
  };
  const syncOrder = () => {
    const selected = new Set(options.filter((option) => option.querySelector<HTMLInputElement>('input')!.checked));
    const next = orderOptions(selected, !menu.open);
    promoted = next.promoted;
    if (next.ordered.some((option: HTMLElement, index: number) => option !== currentOrder[index])) {
      const focused = document.activeElement as HTMLElement | null;
      const scrollTop = container.scrollTop;
      container.append(...next.ordered);
      currentOrder = next.ordered;
      if (menu.open && focused && container.contains(focused)) focused.focus({ preventScroll: true });
      container.scrollTop = scrollTop;
    }
    updateDivider();
  };
  refreshFilterMenus.push(syncOrder);
  const filterOptions = () => {
    const value = input.value.toLocaleLowerCase('de');
    options.forEach((option) => (option.hidden = !option.dataset.name!.includes(value)));
    const noMatches = options.every((option) => option.hidden);
    container.hidden = noMatches;
    panel.querySelector<HTMLElement>('[data-option-empty]')!.hidden = !noMatches;
    updateDivider();
  };
  input.addEventListener('input', filterOptions);
  menu.addEventListener('toggle', () => {
    if (!menu.open) {
      input.value = '';
      filterOptions();
      syncOrder();
    }
    container.scrollTop = 0;
  });
});
document.addEventListener('click', (event) => {
  document.querySelectorAll<HTMLDetailsElement>('[data-filter-menu]').forEach((menu) => {
    if (!menu.contains(event.target as Node)) menu.open = false;
  });
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape')
    document
      .querySelectorAll<HTMLDetailsElement>('[data-filter-menu]')
      .forEach((menu) => (menu.open = false));
});
window.addEventListener('popstate', () => {
  clearTimeout(searchTimer);
  state = readState(location.search, data.records, data.groups);
  searchInput.value = state.q || '';
  render();
});
// Canonicalize unknown query values once without adding a history entry.
const query = queryFor(state);
history.replaceState(null, '', `${location.pathname}${query ? '?' + query : ''}${location.hash}`);
setupSelectionPrint(() => {
  const names = (kind: string, ids: string[]) => ids.map((id) =>
    checkboxes.find((input) => input.name === kind && input.value === id)!
      .closest('label')!.querySelector('span')!.textContent!.trim(),
  );
  return {
    letters: searchInput.value.trim() ? [] : [...list.querySelectorAll<HTMLElement>('li[data-letter]')]
      .filter((row) => !row.hidden)
      .map((row) => ({
        id: row.dataset.letter!,
        url: row.querySelector<HTMLAnchorElement>('.letter-card-link')!.href,
      })),
    info: {
      description: selectionDescription(names('person', state.people), names('place', state.places)),
      period: state.group === 'all' ? 'Alle Jahre' : document.querySelector<HTMLElement>('[data-group][aria-current="page"]')!.textContent!.trim(),
    },
  };
});
render();
