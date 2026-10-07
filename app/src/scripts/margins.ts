import { placeMarginItem, leftMarginOffset } from '../lib/margin-placement.mjs';
import { groupHandLabelLines, handLabelNames, handRefsOnLine } from '../lib/hand-label-groups.mjs';
import { handTextNodes } from '../lib/hand-text';
import { initializeHandControls } from './hand-controls';
import { registerLayoutTask } from './reading-layout';

const layout = document.querySelector<HTMLElement>('[data-reading-layout]');
if (layout) {
  const body = layout.querySelector<HTMLElement>('.letter-body')!;
  const margin = layout.querySelector<HTMLElement>('.marginalia')!;
  const pageMargin = layout.querySelector<HTMLElement>('.page-margin')!;
  const rotationLabels = [...body.querySelectorAll<HTMLElement>('div.tr > .tr-label')]
    .filter((label) => !label.closest('.sidenote') && label.dataset.rot !== '0')
    .map((label, index) => {
      const block = label.parentElement!;
      label.dataset.rotationBlock = block.dataset.rotationBlock = String(index);
      return { label, block };
    });
  const restoreRotationLabels = () => {
    for (const { label, block } of rotationLabels) {
      label.style.top = '';
      label.style.removeProperty('--left-margin-offset');
      block.prepend(label);
    }
  };
  // Keep the original buttons and their highlighting listeners when labels merge.
  const handLabels = [...margin.querySelectorAll<HTMLElement>('.hand-label')].map((item) => {
    const button = item.querySelector<HTMLButtonElement>('[data-hand-ref]')!;
    const ref = button.dataset.handRef!;
    return { item, button, ref, name: button.textContent!.trim(), buttons: new Map([[ref, button]]) };
  });
  const namesByRef = new Map(handLabels.map(({ ref, name }) => [ref, name]));
  const bindHandControl = initializeHandControls(layout);
  function lineCenter(anchor: HTMLElement) {
    const containingLine = anchor.closest<HTMLElement>('.lb-line-block');
    let block = containingLine ?? anchor.querySelector<HTMLElement>('.lb-line-block');
    let next: Element | null = anchor;
    while (!block && next && next !== body) {
      if (next.nextElementSibling) {
        next = next.nextElementSibling;
        block = next.matches('.lb-line-block') ? next as HTMLElement
          : next.querySelector<HTMLElement>('.lb-line-block');
      } else next = next.parentElement;
    }
    const bounds = (block ?? anchor).getBoundingClientRect();
    const style = getComputedStyle(block ?? anchor);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3;
    const anchorBounds = anchor.getBoundingClientRect();
    const row = containingLine
      ? Math.max(0, Math.floor((anchorBounds.top + anchorBounds.height / 2 - bounds.top) / lineHeight))
      : 0;
    return bounds.top + (row + .5) * lineHeight;
  }
  function arrange() {
    // Restore labels before measuring, including when returning to narrow screens.
    restoreRotationLabels();
    layout!.classList.remove('margin-ready');
    margin.style.height = '';
    pageMargin.style.height = '';
    for (const { item, button, name } of handLabels) {
      item.hidden = false;
      button.textContent = name;
      button.removeAttribute('aria-label');
      item.replaceChildren(button);
    }
    const pageNumbers = [...pageMargin.querySelectorAll<HTMLElement>('.page-number')];
    pageNumbers.forEach((item) => {
      item.style.top = '';
      item.classList.remove('has-rotation');
      item.style.removeProperty('--left-margin-offset');
    });
    const items = [...margin.querySelectorAll<HTMLElement>('.marginal-item')];
    items.forEach((item) => {
      item.style.top = '';
    });
    if (matchMedia('print').matches || !matchMedia('(min-width: 1100px)').matches) {
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
    const handAnchors = handLabels.flatMap((label) => {
      const anchor = document.getElementById(label.item.dataset.anchor!);
      return anchor ? [{ ...label, target: anchor.getBoundingClientRect().top - origin }] : [];
    });
    const textHands = handTextNodes(body, layout!.dataset.baseHand).map(({ node, ref }) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return { ref, tops: [...range.getClientRects()].map((rect) => rect.top - origin) };
    });
    for (const group of groupHandLabelLines(handAnchors)) {
      // A continuing writer may share this line without having a new anchor.
      const refs = handRefsOnLine(group, textHands).filter((ref) => namesByRef.has(ref));
      const names = handLabelNames(refs.map((ref) => namesByRef.get(ref)!));
      const first = group[0].item;
      first.replaceChildren();
      refs.forEach((ref, index) => {
        let button = group[0].buttons.get(ref);
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.dataset.handRef = ref;
          group[0].buttons.set(ref, button);
          bindHandControl(button);
        }
        button.textContent = names[index];
        button.setAttribute('aria-label', namesByRef.get(ref)!);
        if (index) first.append(', ');
        first.append(button);
      });
      for (const { item } of group.slice(1)) item.hidden = true;
    }
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
    // Reserve horizontal space only where items share vertical space.
    const rotations = rotationLabels.map(({ label, block }) => ({ label,
      center: lineCenter(block) - pageMargin.getBoundingClientRect().top,
    }));
    rotations.forEach(({ label }) => pageMargin.append(label));
    const leftSlots: { top: number; bottom: number; offset: number; width: number }[] = [];
    for (const { label, center } of rotations.sort((a, b) => a.center - b.center)) {
      const rect = label.getBoundingClientRect();
      const top = Math.max(0, center - rect.height / 2);
      const offset = leftMarginOffset(top, rect.height, leftSlots);
      label.style.top = `${top}px`;
      label.style.setProperty('--left-margin-offset', `${offset}px`);
      leftSlots.push({ top, bottom: top + rect.height, offset, width: rect.width });
    }
    const measuredPages = pageNumbers.map(measure).filter((entry) => entry.anchor);
    const anchored = items
      .filter((item) => !item.hidden)
      .map(measure)
      .filter((entry) => entry.anchor)
      .sort(
        (a, b) =>
          a.target - b.target || Number(a.item.dataset.priority) - Number(b.item.dataset.priority),
      );
    const placements: { item: HTMLElement; top: number }[] = [];
    let pageBottom = 0;
    for (const { item, anchor, height } of measuredPages) {
      const linkBounds = item.querySelector('a')!.getBoundingClientRect();
      const top = Math.max(0, lineCenter(anchor!) - pageMargin.getBoundingClientRect().top - height / 2);
      const width = linkBounds.width;
      const offset = leftMarginOffset(top, height, leftSlots);
      item.style.setProperty('--left-margin-offset', `${offset}px`);
      leftSlots.push({ top, bottom: top + height, offset, width });
      placements.push({ item, top });
      pageBottom = Math.max(pageBottom, top + height + 18);
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
    pageMargin.style.height = `${Math.max(0, pageBottom - 18, ...leftSlots.map(slot => slot.bottom))}px`;
    margin.style.height = `${Math.max(0, ...occupied.map((slot) => slot.bottom))}px`;
    // Keep the initial layout hidden until both fonts and placement are ready.
    if (document.fonts.status === 'loaded') layout!.classList.add('margins-visible');
  }
  const schedule = registerLayoutTask(arrange, { phase: 'arrange', observe: [body] });
  window.addEventListener('beforeprint', () => {
    restoreRotationLabels();
    schedule();
  });
  window.addEventListener('afterprint', schedule);
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
