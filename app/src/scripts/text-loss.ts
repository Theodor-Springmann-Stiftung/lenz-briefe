import { registerLayoutTask } from './reading-layout';
import { placeMarginItem } from '../lib/margin-placement.mjs';
import { textLossSegments } from '../lib/text-loss-line.mjs';
import { createHandRangeHighlighter } from './hand-ranges';

const layout = document.querySelector<HTMLElement>('[data-reading-layout]');
const body = layout?.querySelector<HTMLElement>('.letter-body');
const reason = layout?.querySelector<HTMLElement>('[data-text-loss-reason]');
const footer = document.querySelector<HTMLElement>('[data-text-loss-footer] .apparatus-text');
if (layout && body && reason) {
  const markers = [...body.querySelectorAll<HTMLElement>('.tl')];
  const blocks = [...new Set(markers.map((marker) =>
    marker.closest<HTMLElement>('.lb-line-block, .lb-tab-prefix, .tab'),
  ).filter((block): block is HTMLElement => block !== null))];
  if (footer) {
    footer.tabIndex = 0;
    const highlightPassage = createHandRangeHighlighter();
    highlightPassage(footer, []);
  }
  const lines: HTMLElement[] = [];
  let hovered: HTMLElement | null = null;
  let focused: HTMLElement | null = null;
  let hoveredFooter = false;
  let focusedFooter = false;
  let lastBlock: HTMLElement | null = null;
  const obstacleElements = () => [...layout.querySelectorAll<HTMLElement>(
    '.sidenote-layout, .hand-label, .hand, .page-number',
  )];

  function draw() {
    const active = hovered || focused;
    const origin = layout!.getBoundingClientRect();
    const bounds = body!.getBoundingClientRect();
    const rects = active ? [active.getBoundingClientRect()] : [];
    const obstacles = obstacleElements().flatMap((element) => [...element.getClientRects()]);
    const x = bounds.left - 12;
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    const segments = rects.length ? textLossSegments(top, bottom, x, obstacles) : [];
    const margin = layout!.querySelector<HTMLElement>('.page-margin')!;
    const marginBounds = margin.getBoundingClientRect();
    const showReason = active && rects.length > 0 && matchMedia('(min-width: 1100px)').matches;
    // Measure the hidden explanation without adding it to the document flow.
    reason!.style.width = `${marginBounds.width}px`;
    reason!.style.visibility = 'hidden';
    reason!.hidden = !showReason;
    const reasonTop = showReason ? placeMarginItem(
      Math.max(0, (top + bottom - reason!.getBoundingClientRect().height) / 2 - marginBounds.top),
      reason!.getBoundingClientRect().height,
      obstacleElements().filter((element) => element.closest('.page-margin')).map((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top - marginBounds.top, bottom: rect.bottom - marginBounds.top, gap: 8 };
      }),
    ).top : 0;
    return () => {
      body!.querySelectorAll('.text-loss-active').forEach((block) => block.classList.remove('text-loss-active'));
      const activeBlocks = hoveredFooter || focusedFooter ? blocks : active ? [active] : [];
      activeBlocks.forEach((block) => block.classList.add('text-loss-active'));
      lines.forEach((line) => { line.hidden = true; });
      segments.forEach((segment, index) => {
        const line = (lines[index] ||= document.createElement('div'));
        line.className = 'text-loss-brace';
        line.setAttribute('aria-hidden', 'true');
        if (!line.parentElement) layout!.append(line);
        line.style.left = `${x - origin.left - 8}px`;
        line.style.top = `${segment.top - origin.top}px`;
        line.style.height = `${segment.bottom - segment.top}px`;
        line.hidden = false;
      });
      reason!.style.left = `${marginBounds.left - origin.left}px`;
      reason!.style.top = `${marginBounds.top - origin.top + reasonTop}px`;
      reason!.style.visibility = '';
    };
  }
  const schedule = registerLayoutTask(draw, { observe: [body, reason] });
  const currentBlock = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Node)) return null;
    const block = blocks.find((block) => block.contains(target));
    if (block) {
      lastBlock = block;
      return lastBlock;
    }
    if (reason!.contains(target) || footer?.contains(target)) {
      return lastBlock || blocks[0] || null;
    }
    return null;
  };
  document.addEventListener('pointerover', (event) => {
    hoveredFooter = event.target instanceof Node && !!footer?.contains(event.target);
    hovered = currentBlock(event.target);
    schedule();
  });
  document.addEventListener('pointerout', (event) => {
    hoveredFooter = event.relatedTarget instanceof Node && !!footer?.contains(event.relatedTarget);
    hovered = currentBlock(event.relatedTarget);
    schedule();
  });
  document.addEventListener('focusin', (event) => {
    focusedFooter = event.target instanceof Node && !!footer?.contains(event.target);
    focused = currentBlock(event.target);
    schedule();
  });
  document.addEventListener('focusout', (event) => {
    focusedFooter = event.relatedTarget instanceof Node && !!footer?.contains(event.relatedTarget);
    focused = currentBlock(event.relatedTarget);
    schedule();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hovered = focused = null;
      hoveredFooter = focusedFooter = false;
      schedule();
    }
  });
  markers.forEach((marker) => {
    marker.tabIndex = 0;
    marker.setAttribute('aria-describedby', footer?.closest('[id]')?.id || reason.id);
    marker.setAttribute('aria-label', 'Textverlust');
  });
}
