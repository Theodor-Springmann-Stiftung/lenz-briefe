interface HandRange { trigger: HTMLElement; groups: HTMLElement[][] }

/** XSLT reopens one source hand across lines; data-origin reunites those spans. */
export function handGroups(container: HTMLElement) {
  const groups = new Map<string, HTMLElement[]>();
  container.querySelectorAll<HTMLElement>('.hand').forEach((hand, index) => {
    const origin = hand.dataset.origin || `hand-${index}`;
    groups.set(origin, [...(groups.get(origin) || []), hand]);
  });
  return [...groups.values()];
}

export function createHandRangeHighlighter() {
  const backgrounds: HTMLElement[] = [];
  let hovered: HandRange | null = null;
  let focused: HandRange | null = null;
  let highlighted: HandRange | null = null;

  function positionBackground() {
    backgrounds.forEach(background => { background.hidden = true; });
    highlighted?.groups.forEach((fragments, index) => {
      const rects = fragments.flatMap(fragment => [...fragment.getClientRects()])
        .filter(rect => rect.width > 0 && rect.height > 0);
      const container = fragments[0]?.closest<HTMLElement>('.edition-text');
      if (!rects.length || !container) return;
      const background = backgrounds[index] ||= document.createElement('div');
      background.className = 'hand-range-background';
      background.setAttribute('aria-hidden', 'true');
      if (background.parentElement !== container) container.append(background);
      const bounds = container.getBoundingClientRect();
      const top = Math.min(...rects.map(rect => rect.top));
      const bottom = Math.max(...rects.map(rect => rect.bottom));
      background.style.left = '-6px';
      background.style.top = `${top - bounds.top + container.scrollTop - container.clientTop - 4}px`;
      background.style.width = `${container.clientWidth + 12}px`;
      background.style.height = `${bottom - top + 8}px`;
      background.hidden = false;
    });
  }

  function update() {
    const active = hovered || focused;
    if (active === highlighted) return;
    highlighted?.trigger.classList.remove('hand-range-active');
    active?.trigger.classList.add('hand-range-active');
    highlighted = active;
    positionBackground();
  }
  window.addEventListener('resize', positionBackground);
  document.addEventListener('margins:arranged', positionBackground);
  document.fonts.addEventListener('loadingdone', positionBackground);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { hovered = null; focused = null; update(); }
  });

  return (trigger: HTMLElement, groups: HTMLElement[][]) => {
    const range = {trigger, groups};
    trigger.classList.add('hand-range-trigger');
    trigger.addEventListener('pointerenter', () => { hovered = range; update(); });
    trigger.addEventListener('pointerleave', () => { if (hovered === range) hovered = null; update(); });
    trigger.addEventListener('focusin', () => { focused = range; update(); });
    trigger.addEventListener('focusout', () => { if (focused === range) focused = null; update(); });
  };
}
