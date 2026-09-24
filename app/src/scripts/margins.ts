import {placeMarginItem} from '../lib/margin-placement.mjs';

const layout = document.querySelector<HTMLElement>('[data-reading-layout]');
if (layout) {
  const body = layout.querySelector<HTMLElement>('.letter-body')!;
  const margin = layout.querySelector<HTMLElement>('.marginalia')!;
  const pageMargin = layout.querySelector<HTMLElement>('.page-margin')!;
  const names = JSON.parse(document.querySelector('#hand-data')?.textContent || '{}');
  const seen = new Set<string>();
  body.querySelectorAll<HTMLElement>('.hand').forEach((hand,index) => {
    const origin = hand.dataset.origin || `mark-${index}`;
    if (seen.has(origin)) return;
    seen.add(origin);
    const id = `hand-${index + 1}`;
    hand.id = id;
    const item = document.createElement('div');
    item.className = 'marginal-item hand-label';
    item.dataset.anchor = id;
    item.dataset.priority = '1';
    const label = document.createElement('a');
    label.href = `#${id}`;
    label.textContent = names[hand.dataset.ref!] || 'Unbekannte Hand';
    item.append(label); margin.append(item);
  });
  // A note already occupies the margin; identify its hands within that note.
  document.querySelectorAll<HTMLElement>('.margin-note, .unplaced-note').forEach(note => {
    const refs = new Set([...note.querySelectorAll<HTMLElement>('.hand')].map(hand => hand.dataset.ref!));
    if (!refs.size) return;
    const label = document.createElement('p');
    label.className = 'note-annotation';
    label.textContent = `Hand: ${new Intl.ListFormat('de', {type:'conjunction'}).format([...refs].map(ref => names[ref] || 'Unbekannte Hand'))}`;
    note.querySelector('.sidenote-details')!.append(label);
  });
  const overflowLabels = new Map<HTMLElement, HTMLElement>();
  margin.querySelectorAll<HTMLElement>('.margin-note').forEach(note => {
    const label = document.createElement('span');
    label.className = 'sidenote-overflow-label';
    label.textContent = `S. ${note.querySelector<HTMLElement>('.sidenote')?.dataset.page}: `;
    label.hidden = true;
    note.querySelector('.sidenote-description')!.prepend(label);
    overflowLabels.set(note, label);
  });
  let scheduled = false;
  function arrange() {
    scheduled = false;
    layout!.classList.remove('margin-ready');
    margin.style.height = '';
    pageMargin.style.height = '';
    const pageNumbers = [...pageMargin.querySelectorAll<HTMLElement>('.page-number')];
    pageNumbers.forEach(item => {item.style.top = '';});
    const items = [...margin.querySelectorAll<HTMLElement>('.marginal-item')];
    items.forEach(item => {item.style.top = '';});
    overflowLabels.forEach(label => {label.hidden = true;});
    if (!matchMedia('(min-width: 1100px)').matches) return;
    const origin = body.getBoundingClientRect().top;
    layout!.classList.add('margin-ready');
    const pages = [...body.querySelectorAll<HTMLElement>('.page-anchor')];
    const pageBounds = new Map(pages.map((page, index) => [page.id, {
      start: Math.max(0, page.getBoundingClientRect().top - origin),
      end: (pages[index + 1]?.getBoundingClientRect().top ?? body.getBoundingClientRect().bottom) - origin,
    }]));
    // Page numbers occupy their own left margin, independently of right-hand notes.
    let pageBottom = 0;
    for (const item of pageNumbers) {
      const anchor = document.getElementById(item.dataset.anchor!);
      if (!anchor) continue;
      const top = Math.max(0, pageBottom, anchor.getBoundingClientRect().top - origin);
      item.style.top = `${top}px`;
      pageBottom = top + item.getBoundingClientRect().height + 18;
    }
    pageMargin.style.height = `${Math.max(0, pageBottom - 18)}px`;
    // One ordered stream: notes may cross page boundaries, and later items
    // follow immediately after them instead of reserving or searching page slots.
    const anchored = items.map(item => {
      const anchor = document.getElementById(item.dataset.anchor!);
      const bounds = pageBounds.get(item.dataset.anchor!);
      return {item, anchor, target: bounds?.start ?? (anchor ? anchor.getBoundingClientRect().top - origin : 0),
        pageEnd: bounds?.end ?? Infinity};
    }).filter(entry => entry.anchor).sort((a, b) => a.target - b.target
      || Number(a.item.dataset.priority) - Number(b.item.dataset.priority));
    let bottom = -18;
    let previousWasNote = false;
    for (const {item, target, pageEnd} of anchored) {
      const isNote = item.classList.contains('margin-note');
      const gap = isNote && previousWasNote ? 6 : 18;
      let placement = placeMarginItem(target, item.getBoundingClientRect().height, bottom, pageEnd, gap);
      const label = overflowLabels.get(item);
      if (label && placement.overflow) {
        label.hidden = false;
        // The page label may wrap the description; measure before placing the next item.
        placement = placeMarginItem(target, item.getBoundingClientRect().height, bottom, pageEnd, gap);
      }
      item.style.top = `${placement.top}px`;
      bottom = placement.bottom;
      previousWasNote = isNote;
    }
    margin.style.height = `${Math.max(0, bottom)}px`;
    document.dispatchEvent(new Event('margins:arranged'));
  }
  function schedule() {if (!scheduled) {scheduled = true; requestAnimationFrame(arrange);}}
  document.fonts.ready.then(schedule);
  document.fonts.addEventListener('loadingdone', schedule);
  window.addEventListener('resize', schedule);
  new ResizeObserver(schedule).observe(body);
  schedule();
}
