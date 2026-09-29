import { placeMarginItem } from '../lib/margin-placement.mjs';
import { initializeHandControls } from './hand-controls';
import { registerLayoutTask } from './reading-layout';

const layout = document.querySelector<HTMLElement>('[data-reading-layout]');
if (layout) {
  const body = layout.querySelector<HTMLElement>('.letter-body')!;
  const margin = layout.querySelector<HTMLElement>('.marginalia')!;
  const pageMargin = layout.querySelector<HTMLElement>('.page-margin')!;
  initializeHandControls(layout);
  function arrange() {
    layout!.classList.remove('margin-ready');
    margin.style.height = '';
    pageMargin.style.height = '';
    const pageNumbers = [...pageMargin.querySelectorAll<HTMLElement>('.page-number')];
    pageNumbers.forEach((item) => {
      item.style.top = '';
    });
    const items = [...margin.querySelectorAll<HTMLElement>('.marginal-item')];
    items.forEach((item) => {
      item.style.top = '';
    });
    if (!matchMedia('(min-width: 1100px)').matches) {
      layout!.classList.remove('margins-visible');
      return;
    }
    // Establish the positioned layout once, then read every anchor and item before writing.
    layout!.classList.add('margin-ready');
    [...pageNumbers, ...items].forEach((item) => {
      item.style.top = '0px';
    });
    const bodyBounds = body.getBoundingClientRect();
    const origin = bodyBounds.top;
    const marginTop = margin.getBoundingClientRect().top;
    const pages = [...body.querySelectorAll<HTMLElement>('.page-anchor')];
    const pageTops = pages.map((page) => page.getBoundingClientRect().top - origin);
    const pageBounds = new Map(
      pages.map((page, index) => [
        page.id,
        {
          start: Math.max(0, pageTops[index]),
          end: pageTops[index + 1] ?? bodyBounds.bottom - origin,
        },
      ]),
    );
    const measure = (item: HTMLElement) => {
      const anchor = document.getElementById(item.dataset.anchor!);
      const bounds = pageBounds.get(item.dataset.anchor!);
      const rect = item.getBoundingClientRect();
      return {
        item,
        anchor,
        target: bounds?.start ?? (anchor ? anchor.getBoundingClientRect().top - origin : 0),
        pageEnd: bounds?.end ?? Infinity,
        height: rect.height,
        // At top:0 this includes the hand label's CSS baseline transform.
        offset: rect.top - marginTop,
      };
    };
    const measuredPages = pageNumbers.map(measure).filter((entry) => entry.anchor);
    const anchored = items
      .map(measure)
      .filter((entry) => entry.anchor)
      .sort(
        (a, b) =>
          a.target - b.target || Number(a.item.dataset.priority) - Number(b.item.dataset.priority),
      );
    const placements: { item: HTMLElement; top: number }[] = [];
    let pageBottom = 0;
    for (const { item, target, height } of measuredPages) {
      const top = Math.max(0, pageBottom, target);
      placements.push({ item, top });
      pageBottom = top + height + 18;
    }
    const occupied: { top: number; bottom: number; gap: number }[] = [];
    for (const { item, target, height, offset } of anchored.filter((entry) =>
      entry.item.classList.contains('hand-label'),
    )) {
      const top = Math.max(0, target);
      placements.push({ item, top });
      const visualTop = marginTop - origin + top + offset;
      occupied.push({ top: visualTop, bottom: visualTop + height, gap: 18 });
    }
    for (const { item, target, pageEnd, height } of anchored.filter((entry) =>
      entry.item.classList.contains('margin-note'),
    )) {
      const placement = placeMarginItem(target, height, occupied, pageEnd);
      placements.push({ item, top: placement.top });
      occupied.push({ top: placement.top, bottom: placement.bottom, gap: 6 });
    }
    for (const { item, top } of placements) item.style.top = `${top}px`;
    pageMargin.style.height = `${Math.max(0, pageBottom - 18)}px`;
    margin.style.height = `${Math.max(0, ...occupied.map((slot) => slot.bottom))}px`;
    // Keep the initial layout hidden until both fonts and placement are ready.
    if (document.fonts.status === 'loaded') layout!.classList.add('margins-visible');
  }
  const schedule = registerLayoutTask(arrange, { phase: 'arrange', observe: [body] });
  const initialTarget = document.getElementById(location.hash.slice(1));
  if (initialTarget?.closest('.edition-text')) {
    // Search links can target notes that move from normal flow into the margin.
    // Wait for the browser's initial fragment jump as well as fonts and layout.
    const jumpToTarget = () =>
      document.fonts.ready.then(() => {
        schedule();
        requestAnimationFrame(() =>
          (initialTarget.querySelector('.search-match') || initialTarget).scrollIntoView({
            behavior: 'instant',
            block: 'start',
          }),
        );
      });
    if (document.readyState === 'complete') jumpToTarget();
    else window.addEventListener('load', jumpToTarget, { once: true });
  }
}
