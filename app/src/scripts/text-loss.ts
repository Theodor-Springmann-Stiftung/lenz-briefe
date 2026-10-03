import { registerLayoutTask } from './reading-layout';
import { textLossRightEdge } from '../lib/text-loss-placement.mjs';

const footer = document.querySelector<HTMLElement>('[data-text-loss-footer] .apparatus-text');
const markers = document.querySelectorAll<HTMLElement>('.letter-body .tl, .sidenote .tl');
const blocks = new Set<HTMLElement>();
for (const marker of markers) {
  marker.tabIndex = 0;
  marker.setAttribute('aria-label', 'Textverlust');
  const explanationId = footer?.closest('[id]')?.id;
  if (explanationId) marker.setAttribute('aria-describedby', explanationId);
  const block = marker.closest<HTMLElement>('.lb-line-block')
    || marker.closest<HTMLElement>('.tab, .lb-tab-prefix') || marker;
  block.classList.add('text-loss-block');
  blocks.add(block);
}

// The apparatus explanation highlights every loss, including those in sidenotes.
if (footer && markers.length) {
  footer.tabIndex = 0;
  const highlight = () => {
    const active = footer.matches(':hover, :focus-within');
    markers.forEach((marker) => marker.classList.toggle('text-loss-active', active));
    footer.classList.toggle('text-loss-value-active', active
      || [...blocks].some((block) => block.matches(':hover, :focus-within')));
  };
  for (const target of [footer, ...blocks]) {
    target.addEventListener('mouseenter', highlight);
    target.addEventListener('mouseleave', highlight);
    target.addEventListener('focusin', highlight);
    target.addEventListener('focusout', highlight);
  }
}

// A single visual copy follows the active loss. The original apparatus entry
// remains the accessible description and the source of the explanation text.
const body = document.querySelector<HTMLElement>('.letter-body');
if (footer?.textContent?.trim() && body && markers.length) {
  const explanation = document.createElement('div');
  explanation.className = 'text-loss-reason';
  const reasonText = document.createElement('span');
  reasonText.textContent = footer.innerText.trim();
  explanation.append(reasonText);
  explanation.setAttribute('aria-hidden', 'true');
  document.body.append(explanation);
  let hovered: HTMLElement | null = null;
  let focused: HTMLElement | null = null;
  let dismissed = false;
  const wideLayout = window.matchMedia('(min-width: 1100px)');

  function position() {
    const marker = dismissed ? null : hovered || focused;
    if (!wideLayout.matches || !marker || !marker.getClientRects().length) {
      return () => explanation.classList.remove('is-visible');
    }
    const anchor = marker.getBoundingClientRect();
    const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
    if (anchor.bottom < Math.max(0, headerBottom) || anchor.top > window.innerHeight) {
      return () => explanation.classList.remove('is-visible');
    }
    const text = body!.getBoundingClientRect();
    const obstacles = [...document.querySelectorAll<HTMLElement>(
      '.page-margin .page-number a, .page-margin .tr-label, .letter-body div.tr > .tr-label',
    )].filter((element) => element.getClientRects().length)
      .map((element) => element.getBoundingClientRect());
    const padding = 12;
    let right = text.left - 20;
    // Small baseline correction for the smaller margin text.
    const top = anchor.top + 3;
    // Wrapping can expose another obstacle, so narrow monotonically until stable.
    for (let pass = 0; pass <= obstacles.length + 1; pass++) {
      explanation.style.width = `${Math.max(1, Math.min(180, right - padding))}px`;
      const height = explanation.getBoundingClientRect().height;
      const next = textLossRightEdge(right, top, height, obstacles);
      if (next === right) break;
      right = next;
    }
    if (right - padding < 80) {
      return () => explanation.classList.remove('is-visible');
    }
    const left = right - explanation.getBoundingClientRect().width;
    return () => {
      explanation.style.left = `${left}px`;
      explanation.style.top = `${top}px`;
      explanation.classList.add('is-visible');
    };
  }
  const schedule = registerLayoutTask(position, { observe: [body], scroll: true });
  const markerIn = (block: HTMLElement, target: EventTarget | null) => {
    const direct = target instanceof Element ? target.closest<HTMLElement>('.tl') : null;
    return direct && block.contains(direct) ? direct
      : block.matches('.tl') ? block : block.querySelector<HTMLElement>('.tl');
  };
  for (const block of blocks) {
    block.addEventListener('mouseenter', (event) => {
      hovered = markerIn(block, event.target);
      dismissed = false;
      schedule();
    });
    block.addEventListener('mouseover', (event) => {
      const marker = markerIn(block, event.target);
      if (marker !== hovered) { hovered = marker; dismissed = false; schedule(); }
    });
    block.addEventListener('mouseleave', () => { hovered = null; schedule(); });
    block.addEventListener('focusin', (event) => {
      focused = markerIn(block, event.target);
      dismissed = false;
      schedule();
    });
    block.addEventListener('focusout', () => { focused = null; schedule(); });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { dismissed = true; schedule(); }
  });
}
