const reading = document.querySelector<HTMLElement>('[data-reading-layout]');
if (reading) {
  const groups = new Map<string, HTMLElement[]>();
  document.querySelectorAll<HTMLElement>('.letter-body .fn[data-index], .margin-note .fn[data-index], .unplaced-note .fn[data-index]').forEach(marker => {
    const key = marker.dataset.index!;
    groups.set(key, [...(groups.get(key) || []), marker]);
  });
  // An index denotes a marker, not a globally unique reference. Only pair
  // unambiguous occurrences within this letter; never guess repeated marks.
  const pairs = [...groups.values()].filter(group => group.length === 2) as [HTMLElement, HTMLElement][];
  const svgNS = 'http://www.w3.org/2000/svg';
  const overlay = document.createElementNS(svgNS, 'svg');
  overlay.classList.add('note-connections');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);
  let hovered: Element | null = null;
  let focused: Element | null = null;
  let scheduled = false;

  const trigger = (target: EventTarget | null): Element | null => target instanceof Element
    ? target.closest('.fn[data-note-connected], .margin-note:has(.fn[data-note-connected] .anchor), .unplaced-note:has(.fn[data-note-connected] .anchor)') : null;
  const point = (marker: HTMLElement) => {
    const anchors = marker.querySelectorAll('.anchor');
    if (!anchors.length) {
      const rect = marker.getClientRects()[0] || marker.getBoundingClientRect();
      return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius:2, anchorless:true};
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
        rects.push(...Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0));
      }
    }
    if (!rects.length) rects.push(anchors[0].getBoundingClientRect());
    const left = Math.min(...rects.map(rect => rect.left));
    const right = Math.max(...rects.map(rect => rect.right));
    const top = Math.min(...rects.map(rect => rect.top));
    const bottom = Math.max(...rects.map(rect => rect.bottom));
    return {
      x:(left + right) / 2, y:(top + bottom) / 2,
      radius:Math.hypot(right - left, bottom - top) / 2 + 2,
      anchorless:false,
    };
  };
  function draw() {
    scheduled = false;
    overlay.replaceChildren();
    if (!hovered && !focused) return;
    for (const pair of pairs) {
      const [a, b] = pair.map(point);
      const direction = b.x >= a.x ? 1 : -1;
      const bend = Math.min(140, Math.max(40, Math.abs(b.x - a.x) / 3));
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', `M ${a.x + direction * a.radius} ${a.y} C ${a.x + direction * bend} ${a.y}, ${b.x - direction * bend} ${b.y}, ${b.x - direction * b.radius} ${b.y}`);
      overlay.append(path);
      for (const p of [a, b]) {
        const circle = document.createElementNS(svgNS, 'circle');
        if (p.anchorless) circle.classList.add('anchorless-endpoint');
        circle.setAttribute('cx', String(p.x));
        circle.setAttribute('cy', String(p.y));
        circle.setAttribute('r', String(p.radius));
        overlay.append(circle);
      }
    }
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(draw); }
  }
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
  document.addEventListener('pointerover', event => { hovered = trigger(event.target); schedule(); });
  document.addEventListener('pointerout', event => { hovered = trigger(event.relatedTarget); schedule(); });
  document.addEventListener('focusin', event => { focused = trigger(event.target); schedule(); });
  document.addEventListener('focusout', event => { focused = trigger(event.relatedTarget); schedule(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { hovered = null; focused = null; schedule(); }
  });
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule);
  document.addEventListener('margins:arranged', schedule);
  document.fonts.ready.then(schedule);
  new ResizeObserver(schedule).observe(reading);
}
