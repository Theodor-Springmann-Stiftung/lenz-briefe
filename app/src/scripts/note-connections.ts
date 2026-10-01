import { registerLayoutTask } from './reading-layout';

const reading = document.querySelector<HTMLElement>('[data-reading-layout]');
if (reading) {
  const groups = new Map<string, HTMLElement[]>();
  document
    .querySelectorAll<HTMLElement>(
      '.letter-body .fn[data-index], .margin-note .fn[data-index], .unplaced-note .fn[data-index]',
    )
    .forEach((marker) => {
      const key = marker.dataset.index!;
      groups.set(key, [...(groups.get(key) || []), marker]);
    });
  // An index denotes a marker, not a globally unique reference. Only pair
  // unambiguous occurrences within this letter; never guess repeated marks.
  const pairs = [...groups.values()].filter((group) => group.length === 2) as [
    HTMLElement,
    HTMLElement,
  ][];
  const svgNS = 'http://www.w3.org/2000/svg';
  const overlay = document.createElementNS(svgNS, 'svg');
  overlay.classList.add('note-connections');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);
  let hovered: Element | null = null;
  let focused: Element | null = null;

  const trigger = (target: EventTarget | null): Element | null =>
    target instanceof Element
      ? target.closest(
          '.fn[data-note-connected], .margin-note:has(.fn[data-note-connected]), .unplaced-note:has(.fn[data-note-connected]), .inpos-note:has(.fn[data-note-connected])',
        )
      : null;
  const measureMarker = (marker: HTMLElement) => {
    const anchors = marker.querySelectorAll('.anchor');
    if (!anchors.length) {
      const rect = marker.getClientRects()[0] || marker.getBoundingClientRect();
      const offset =
        marker.hasAttribute('data-empty') &&
        marker.closest('.margin-note, .unplaced-note, .inpos-note')
          ? 5
          : 0;
      return {
        x: rect.left + rect.width / 2 - offset,
        y: rect.top + rect.height / 2,
        radius: 2,
        anchorless: true,
      };
    }
    // Measure text runs individually: an inline wrapper's own box remains on
    // the baseline even when its contents are raised, lowered, or mixed.
    const rects: DOMRect[] = [];
    for (const anchor of anchors) {
      const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
      let text: Node | null;
      while ((text = walker.nextNode())) {
        if (!text.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(text);
        rects.push(
          ...Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0),
        );
      }
    }
    if (!rects.length) rects.push(anchors[0].getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return {
      x: (left + right) / 2,
      y: (top + bottom) / 2,
      radius: Math.hypot(right - left, bottom - top) / 2 + 2,
      anchorless: false,
    };
  };
  function draw() {
    const fragment = document.createDocumentFragment();
    if (!hovered && !focused) return () => overlay.replaceChildren();
    for (const pair of pairs) {
      const [source, target] = pair.map(measureMarker);
      const horizontalDirection = target.x >= source.x ? 1 : -1;
      const horizontalDistance = Math.abs(target.x - source.x);
      const minimumBend = 40; // Pixels.
      const maximumBend = 190;
      const controlPointOffset = Math.min(
        maximumBend,
        Math.max(minimumBend, horizontalDistance * 0.45),
      );

      // Start and end at the facing edges of the marker circles.
      const start = {
        x: source.x + horizontalDirection * source.radius,
        y: source.y,
      };
      const end = {
        x: target.x - horizontalDirection * target.radius,
        y: target.y,
      };
      // Control points share their endpoint's height, so the curve leaves
      // and arrives horizontally. Their offsets are measured from marker centers.
      const firstControlPoint = {
        x: source.x + horizontalDirection * controlPointOffset,
        y: source.y,
      };
      const secondControlPoint = {
        x: target.x - horizontalDirection * controlPointOffset,
        y: target.y,
      };

      const path = document.createElementNS(svgNS, 'path');
      // SVG: M moves to the start; C uses two control points to curve toward the end.
      path.setAttribute(
        'd',
        `M ${start.x} ${start.y} ` +
          `C ${firstControlPoint.x} ${firstControlPoint.y}, ` +
          `${secondControlPoint.x} ${secondControlPoint.y}, ${end.x} ${end.y}`,
      );
      fragment.append(path);
      for (const marker of [source, target]) {
        const circle = document.createElementNS(svgNS, 'circle');
        if (marker.anchorless) circle.classList.add('anchorless-endpoint');
        circle.setAttribute('cx', String(marker.x));
        circle.setAttribute('cy', String(marker.y));
        circle.setAttribute('r', String(marker.radius));
        fragment.append(circle);
      }
    }
    return () => overlay.replaceChildren(fragment);
  }
  const schedule = registerLayoutTask(draw, { observe: [reading], scroll: true });
  for (const pair of pairs) {
    for (const marker of pair) {
      marker.dataset.noteConnected = 'true';
      marker.tabIndex = 0;
      const label = marker.textContent?.trim()
        ? `Fußnotenmarke ${marker.textContent.trim()}`
        : `Fußnotenstelle ${marker.dataset.index} ohne sichtbares Zeichen`;
      marker.setAttribute('aria-label', `${label}: alle Verbindungen im Brief anzeigen`);
    }
  }
  document.addEventListener('pointerover', (event) => {
    hovered = trigger(event.target);
    schedule();
  });
  document.addEventListener('pointerout', (event) => {
    hovered = trigger(event.relatedTarget);
    schedule();
  });
  document.addEventListener('focusin', (event) => {
    focused = trigger(event.target);
    schedule();
  });
  document.addEventListener('focusout', (event) => {
    focused = trigger(event.relatedTarget);
    schedule();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hovered = null;
      focused = null;
      schedule();
    }
  });
}
