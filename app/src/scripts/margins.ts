import {noteTarget, freePosition} from '../lib/margin-placement.mjs';

const layout = document.querySelector<HTMLElement>('[data-reading-layout]');
if (layout) {
  const body = layout.querySelector<HTMLElement>('.letter-body')!;
  const margin = layout.querySelector<HTMLElement>('.marginalia')!;
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
    note.append(label);
  });
  const overflowLabels = new Map<HTMLElement, HTMLElement>();
  margin.querySelectorAll<HTMLElement>('.margin-note').forEach(note => {
    const label = document.createElement('p');
    label.className = 'sidenote-overflow-label';
    label.textContent = `Zu Seite ${note.querySelector<HTMLElement>('.sidenote')?.dataset.page}:`;
    label.hidden = true;
    note.insertBefore(label, note.querySelector('.edition-text'));
    overflowLabels.set(note, label);
  });
  let scheduled = false;
  function arrange() {
    scheduled = false;
    layout!.classList.remove('margin-ready');
    margin.style.height = '';
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
    const occupied: {top:number; bottom:number}[] = [];
    const fixed = items.filter(item => !item.classList.contains('margin-note')).map(item => {
      const anchor = document.getElementById(item.dataset.anchor!);
      return {item, anchor, top: anchor ? anchor.getBoundingClientRect().top - origin : 0};
    }).filter(t => t.anchor).sort((a,b) => a.top - b.top || Number(a.item.dataset.priority) - Number(b.item.dataset.priority));
    let bottom = 0;
    for (const {item,top} of fixed) {
      const position = Math.max(top, bottom, 0);
      item.style.top = `${position}px`;
      const end = position + item.getBoundingClientRect().height;
      occupied.push({top:position, bottom:end});
      bottom = end + 18;
    }
    const overflow: {item:HTMLElement; sourcePage:number}[] = [];
    const boundsList = [...pageBounds.values()];
    let pageIndex = 0;
    for (const [pageId, bounds] of pageBounds) {
      const notes = items.filter(item => item.classList.contains('margin-note') && item.dataset.anchor === pageId);
      const heights = notes.map(item => item.getBoundingClientRect().height);
      // Reserve native notes first so overflow cannot displace a later page's
      // own notes. Keep the largest fitting prefix, moving whole notes only.
      let count = notes.length;
      for (; count > 0; count--) {
        const height = heights.slice(0, count).reduce((sum, value) => sum + value, 0) + (count - 1) * 18;
        const target = noteTarget(bounds.start, bounds.end, height);
        let top = freePosition(target, height, bounds.start, bounds.end, occupied, false);
        if (top === null) continue;
        occupied.push({top, bottom:top + height});
        for (let index = 0; index < count; index++) {
          notes[index].style.top = `${top}px`;
          top += heights[index] + 18;
        }
        break;
      }
      overflow.push(...notes.slice(count).map(item => ({item, sourcePage:pageIndex})));
      pageIndex++;
    }
    let overflowEnd = 0;
    for (const {item, sourcePage} of overflow) {
      overflowLabels.get(item)!.hidden = false;
      const height = item.getBoundingClientRect().height;
      let top: number | null = null;
      for (const bounds of boundsList.slice(sourcePage + 1)) {
        const start = Math.max(bounds.start, overflowEnd);
        top = freePosition(start, height, start, bounds.end - 18, occupied, false);
        if (top !== null) break;
      }
      // If no remaining page can hold the whole note, retain it below the
      // final page rather than letting a page marker cut through its text.
      if (top === null) {
        const start = Math.max(body.getBoundingClientRect().bottom - origin + 18, overflowEnd);
        top = freePosition(start, height, start, Infinity, occupied)!;
      }
      item.style.top = `${top}px`;
      occupied.push({top, bottom:top + height});
      overflowEnd = top + height + 18;
    }
    margin.style.height = `${Math.max(0, ...occupied.map(item => item.bottom))}px`;
    document.dispatchEvent(new Event('margins:arranged'));
  }
  function schedule() {if (!scheduled) {scheduled = true; requestAnimationFrame(arrange);}}
  document.fonts.ready.then(schedule);
  document.fonts.addEventListener('loadingdone', schedule);
  window.addEventListener('resize', schedule);
  new ResizeObserver(schedule).observe(body);
  schedule();
}
