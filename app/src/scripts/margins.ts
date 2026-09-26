import {placeMarginItem} from '../lib/margin-placement.mjs';
import {createHandRangeHighlighter, handGroups, implicitHandGroups} from './hand-ranges';

const layout = document.querySelector<HTMLElement>('[data-reading-layout]');
if (layout) {
  const body = layout.querySelector<HTMLElement>('.letter-body')!;
  const margin = layout.querySelector<HTMLElement>('.marginalia')!;
  const pageMargin = layout.querySelector<HTMLElement>('.page-margin')!;
  const names = JSON.parse(document.querySelector('#hand-data')?.textContent || '{}');
  const allHandGroups = [...document.querySelectorAll<HTMLElement>('.letter-body, .margin-note, .unplaced-note')]
    .flatMap(container => handGroups(container));
  const implicitGroups = [...document.querySelectorAll<HTMLElement>('.letter-body, .margin-note > .edition-text, .unplaced-note > .edition-text')]
    .flatMap(container => implicitHandGroups(container));
  const groupsForHand = (ref: string | undefined) => [
    ...allHandGroups.filter(fragments => fragments[0].dataset.ref === ref),
    ...(ref && ref === layout.dataset.baseHand ? implicitGroups : []),
  ];
  const highlightHand = createHandRangeHighlighter();
  handGroups(body).forEach((fragments,index) => {
    const hand = fragments[0];
    const id = `hand-${index + 1}`;
    hand.id = id;
    const item = document.createElement('div');
    item.className = 'marginal-item hand-label';
    item.dataset.anchor = id;
    item.dataset.priority = '1';
    const label = document.createElement('button');
    label.type = 'button';
    label.textContent = names[hand.dataset.ref!] || 'Unbekannte Hand';
    highlightHand(label, groupsForHand(hand.dataset.ref));
    item.append(label); margin.append(item);
  });
  // A note already occupies the margin; identify its hands within that note.
  document.querySelectorAll<HTMLElement>('.margin-note, .unplaced-note').forEach(note => {
    const groups = handGroups(note);
    if (!groups.length) return;
    const label = document.createElement('p');
    label.className = 'note-annotation';
    label.append('Hand: ');
    groups.forEach((fragments, index) => {
      if (index) label.append(index === groups.length - 1 ? ' und ' : ', ');
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.textContent = names[fragments[0].dataset.ref!] || 'Unbekannte Hand';
      highlightHand(trigger, groupsForHand(fragments[0].dataset.ref));
      label.append(trigger);
    });
    note.querySelector('.sidenote-details')!.append(label);
  });
  document.querySelectorAll<HTMLElement>('.hand-key [data-hand-ref]').forEach(trigger => {
    highlightHand(trigger, groupsForHand(trigger.dataset.handRef));
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
    if (!matchMedia('(min-width: 1100px)').matches) {
      layout!.classList.remove('margins-visible');
      return;
    }
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
    // Reserve hand labels at their text lines before finding space for notes.
    const anchored = items.map(item => {
      const anchor = document.getElementById(item.dataset.anchor!);
      const bounds = pageBounds.get(item.dataset.anchor!);
      return {item, anchor, target: bounds?.start ?? (anchor ? anchor.getBoundingClientRect().top - origin : 0),
        pageEnd: bounds?.end ?? Infinity};
    }).filter(entry => entry.anchor).sort((a, b) => a.target - b.target
      || Number(a.item.dataset.priority) - Number(b.item.dataset.priority));
    const occupied: {top: number; bottom: number; gap: number}[] = [];
    for (const {item, target} of anchored.filter(entry => entry.item.classList.contains('hand-label'))) {
      item.style.top = `${Math.max(0, target)}px`;
      // Include the label's visual baseline adjustment in its reserved space.
      const rect = item.getBoundingClientRect();
      occupied.push({top: rect.top - origin, bottom: rect.bottom - origin, gap: 18});
    }
    for (const {item, target, pageEnd} of anchored.filter(entry => entry.item.classList.contains('margin-note'))) {
      const placement = placeMarginItem(target, item.getBoundingClientRect().height, occupied, pageEnd);
      item.style.top = `${placement.top}px`;
      occupied.push({top: placement.top, bottom: placement.bottom, gap: 6});
    }
    margin.style.height = `${Math.max(0, ...occupied.map(slot => slot.bottom))}px`;
    // Keep the initial layout hidden until both fonts and placement are ready.
    if (document.fonts.status === 'loaded') layout!.classList.add('margins-visible');
    document.dispatchEvent(new Event('margins:arranged'));
  }
  function schedule() {if (!scheduled) {scheduled = true; requestAnimationFrame(arrange);}}
  document.fonts.ready.then(schedule);
  const initialTarget = document.getElementById(location.hash.slice(1));
  if (initialTarget?.closest('.edition-text')) {
    // Search links can target notes that move from normal flow into the margin.
    // Wait for the browser's initial fragment jump as well as fonts and layout.
    const jumpToTarget = () => document.fonts.ready.then(() => {
      schedule();
      requestAnimationFrame(() => (initialTarget.querySelector('.search-match') || initialTarget).scrollIntoView({behavior: 'instant', block: 'start'}));
    });
    if (document.readyState === 'complete') jumpToTarget();
    else window.addEventListener('load', jumpToTarget, {once: true});
  }
  document.fonts.addEventListener('loadingdone', schedule);
  window.addEventListener('resize', schedule);
  new ResizeObserver(schedule).observe(body);
  schedule();
}
