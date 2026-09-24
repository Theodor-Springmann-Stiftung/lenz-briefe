export function readState(search, records, groups) {
  const query = new URLSearchParams(search);
  const people = new Set(records.flatMap(r => r.people));
  const places = new Set(records.flatMap(r => r.places));
  return {
    group: query.get('group') === 'all' || groups.includes(query.get('group')) ? query.get('group') : (query.get('q') ? 'all' : groups[0] || 'all'),
    people: [...new Set(query.getAll('person'))].filter(id => people.has(id)),
    places: [...new Set(query.getAll('place'))].filter(id => places.has(id)),
    sort: query.get('sort') === 'desc' ? 'desc' : 'asc',
    ...(query.get('q') ? {q: query.get('q')} : {}),
  };
}
export function matches(record, state, includeGroup = true) {
  return (!includeGroup || state.group === 'all' || record.group === state.group)
    && (!state.people.length || state.people.some(id => record.people.includes(id)))
    && (!state.places.length || state.places.some(id => record.places.includes(id)));
}
export function hasFilters(state) {
  return state.people.length > 0 || state.places.length > 0 || Boolean(state.q?.trim());
}
export function withFilters(state, people, places) {
  return {...state, group:'all', people, places};
}
export function selectReferenceFilter(state, kind, id) {
  const {q, ...filters} = state;
  return withFilters(filters,
    kind === 'person' ? [id] : [],
    kind === 'place' ? [id] : [],
  );
}
export function removeFilter(state, kind, id) {
  if (kind === 'search') {
    const {q, ...filters} = state;
    return filters;
  }
  return withFilters(state,
    kind === 'person' ? state.people.filter(value => value !== id) : state.people,
    kind === 'place' ? state.places.filter(value => value !== id) : state.places,
  );
}
export function resetFilters(state) {
  return withFilters(removeFilter(state, 'search'), [], []);
}
// The Python catalog is already in ascending chronological order.
export function orderedRecords(records, sort) {
  return sort === 'desc' ? [...records].reverse() : [...records];
}
export function queryFor(state) {
  const query = new URLSearchParams();
  query.set('group', state.group);
  if (state.sort === 'desc') query.set('sort', 'desc');
  state.people.forEach(id => query.append('person', id));
  state.places.forEach(id => query.append('place', id));
  if (state.q) query.set('q', state.q);
  return query.toString();
}
