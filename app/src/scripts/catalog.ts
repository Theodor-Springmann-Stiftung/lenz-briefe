import {readState, matches, queryFor, orderedRecords, hasFilters, withFilters, removeFilter} from '../lib/filters.mjs';
const data = JSON.parse(document.querySelector('#filter-data')!.textContent!);
let state = readState(location.search, data.records, data.groups);
const rows = new Map([...document.querySelectorAll<HTMLElement>('[data-letter]')].map(e => [e.dataset.letter, e]));
const checkboxes = [...document.querySelectorAll<HTMLInputElement>('.filter-options input')];
const list = document.querySelector<HTMLOListElement>('.letter-list')!;
const sortControl = document.querySelector<HTMLSelectElement>('#sort-order')!;
const activeFilters = document.querySelector<HTMLElement>('.active-filters')!;
const pills = document.querySelector<HTMLElement>('.active-filter-pills')!;
function renderFilterPills() {
  activeFilters.hidden = !hasFilters(state);
  const fragment = document.createDocumentFragment();
  for (const kind of ['person', 'place'] as const) {
    const template = document.querySelector<HTMLTemplateElement>(`#filter-pill-${kind}`)!;
    for (const id of kind === 'person' ? state.people : state.places) {
      const input = checkboxes.find(input => input.name === kind && input.value === id)!;
      const name = input.closest('label')!.querySelector('span')!.textContent!;
      const pill = template.content.firstElementChild!.cloneNode(true) as HTMLButtonElement;
      pill.dataset.filterId = id;
      pill.querySelector('.filter-pill-name')!.textContent = name;
      const label = `${kind === 'person' ? 'Personenfilter' : 'Ortsfilter'} entfernen: ${name}`;
      pill.setAttribute('aria-label', label);
      pill.title = label;
      fragment.append(pill);
    }
  }
  pills.replaceChildren(fragment);
}
function render() {
  document.dispatchEvent(new Event('catalog:change'));
  let count = 0;
  for (const record of data.records) {
    const visible = matches(record, state);
    rows.get(record.id)!.hidden = !visible;
    if (visible) count++;
  }
  const ordered = document.createDocumentFragment();
  orderedRecords(data.records, state.sort).forEach((record: {id: string}) => ordered.append(rows.get(record.id)!));
  list.append(ordered);
  sortControl.value = state.sort;
  document.querySelector('#result-count')!.textContent = `${count} ${count === 1 ? 'Brief' : 'Briefe'}`;
  document.querySelector<HTMLElement>('.empty-state')!.hidden = count > 0;
  renderFilterPills();
  checkboxes.forEach(input => input.checked = (input.name === 'person' ? state.people : state.places).includes(input.value));
  for (const kind of ['person', 'place']) {
    const count = (kind === 'person' ? state.people : state.places).length;
    document.querySelector(`[data-selected-count="${kind}"]`)!.textContent = count ? ` (${count})` : '';
  }
  document.querySelectorAll<HTMLAnchorElement>('[data-group]').forEach(link => {
    const group = link.dataset.group!;
    const next = {...state, group};
    const count = data.records.filter((r: any) => matches(r, next)).length;
    if (group !== 'all' && count === 0) {
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
    link.querySelector('span')!.textContent = String(count);
  });
}
function navigate(next: typeof state) {
  state = next;
  const query = queryFor(state);
  const url = `${location.pathname}${query ? '?' + query : ''}`;
  if (url !== location.pathname + location.search) history.pushState(null, '', url);
  render();
}
checkboxes.forEach(input => input.addEventListener('change', () => navigate(withFilters(
  state,
  checkboxes.filter(i => i.name === 'person' && i.checked).map(i => i.value),
  checkboxes.filter(i => i.name === 'place' && i.checked).map(i => i.value),
))));
sortControl.addEventListener('change', () => navigate({...state, sort:sortControl.value === 'desc' ? 'desc' : 'asc'}));
document.querySelectorAll<HTMLAnchorElement>('[data-group]').forEach(link => link.addEventListener('click', event => {
  if (link.getAttribute('aria-disabled') === 'true') {event.preventDefault(); return;}
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
    || document.querySelector<HTMLElement>(`[data-filter-menu="${kind}"] summary`)!;
  nextFocus.focus();
});
document.querySelector('.reset-filters')!.addEventListener('click', () => {
  navigate(withFilters(state,[],[]));
  document.querySelector<HTMLElement>('[data-filter-menu="person"] summary')!.focus();
});
document.querySelector('[data-reset]')!.addEventListener('click', () => navigate(withFilters(state,[],[])));
document.querySelectorAll<HTMLInputElement>('[data-option-search]').forEach(input => input.addEventListener('input', () => {
  const value = input.value.toLocaleLowerCase('de');
  document.querySelectorAll<HTMLElement>(`[data-option="${input.dataset.optionSearch}"]`).forEach(option => option.hidden = !option.dataset.name!.includes(value));
}));
document.addEventListener('click', event => {
  document.querySelectorAll<HTMLDetailsElement>('[data-filter-menu]').forEach(menu => {if (!menu.contains(event.target as Node)) menu.open = false;});
});
document.addEventListener('keydown', event => {if (event.key === 'Escape') document.querySelectorAll<HTMLDetailsElement>('[data-filter-menu]').forEach(menu => menu.open = false);});
window.addEventListener('popstate', () => {state = readState(location.search, data.records, data.groups); render();});
// Canonicalize unknown query values once without adding a history entry.
const query = queryFor(state);
history.replaceState(null, '', `${location.pathname}${query ? '?' + query : ''}${location.hash}`);
render();
