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
    ? target.closest('.fn[data-note-connected], .margin-note, .unplaced-note') : null;
  const point = (marker: HTMLElement) => {
    const rect = (marker.querySelector('.anchor') || marker).getBoundingClientRect();
    return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius:7};
  };
  function draw() {
    scheduled = false;
    overlay.replaceChildren();
    const active = hovered || focused;
    for (const pair of pairs) {
      const selected = !!active && pair.some(marker => active === marker || active.contains(marker));
      if (!selected) continue;
      const [a, b] = pair.map(point);
      const direction = b.x >= a.x ? 1 : -1;
      const bend = Math.min(140, Math.max(40, Math.abs(b.x - a.x) / 3));
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', `M ${a.x + direction * a.radius} ${a.y} C ${a.x + direction * bend} ${a.y}, ${b.x - direction * bend} ${b.y}, ${b.x - direction * b.radius} ${b.y}`);
      overlay.append(path);
      for (const p of [a, b]) {
        const circle = document.createElementNS(svgNS, 'circle');
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
      marker.setAttribute('aria-label', `Fußnotenmarke ${marker.textContent?.trim()}: zugehörige Stelle hervorheben`);
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
