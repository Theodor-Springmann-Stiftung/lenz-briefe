document.querySelectorAll<HTMLElement>('.edition-text .subst').forEach(substitution => {
  const deletions = [...substitution.children].filter(child => child.matches('del'));
  const insertions = [...substitution.children].filter(child => child.matches('.insertion'));
  if (!deletions.length || !insertions.length) return;

  const original = document.createElement('span');
  original.className = 'subst-original';
  const replacement = document.createElement('span');
  replacement.className = 'subst-replacement';
  deletions.forEach(node => original.append(node));
  insertions.forEach(node => {
    const text = document.createElement('span');
    text.className = 'subst-inserted-text';
    // Keep position arrows and the insertion's CSS corner marks outside the inverse text.
    [...node.childNodes].filter(child => !(child instanceof Element && child.matches('.insertion-arrow')))
      .forEach(child => text.append(child));
    node.append(text);
    replacement.append(node);
  });
  substitution.style.setProperty('--subst-ink', getComputedStyle(substitution).color);
  substitution.replaceChildren(original, replacement);
  substitution.classList.add('subst-interactive');
  substitution.tabIndex = 0;
  substitution.setAttribute('role', 'button');

  let hovered = false;
  let locked = false;
  let suppressHover = false;
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  let restoredPointer: {x: number; y: number} | undefined;
  const cancelHoverTimer = () => {
    clearTimeout(hoverTimer);
    hoverTimer = undefined;
  };
  const update = () => {
    const revealed = locked || (hovered && !suppressHover);
    substitution.classList.toggle('subst-revealed', revealed);
    substitution.setAttribute('aria-pressed', String(locked));
    substitution.setAttribute('aria-label', `Ersetzung: ${replacement.textContent}. Ursprünglich: ${original.textContent}. ${locked ? 'Original ausblenden' : 'Original einblenden und festhalten'}.`);
    original.setAttribute('aria-hidden', String(!revealed));
    replacement.setAttribute('aria-hidden', String(revealed));
  };
  const toggle = () => {
    cancelHoverTimer();
    locked = !locked;
    suppressHover = !locked;
    update();
  };
  const enter = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    cancelHoverTimer();
    // Restoring the wider reading can put it back under a stationary pointer.
    // Wait for actual pointer movement instead of starting a reveal/hide loop.
    if (restoredPointer?.x === event.clientX && restoredPointer.y === event.clientY) return;
    restoredPointer = undefined;
    hovered = true;
    suppressHover = false;
    update();
  };
  substitution.addEventListener('pointerenter', enter);
  substitution.addEventListener('pointermove', event => {
    if (restoredPointer) enter(event);
  });
  substitution.addEventListener('pointerleave', event => {
    cancelHoverTimer();
    hoverTimer = setTimeout(() => {
      hoverTimer = undefined;
      restoredPointer = {x: event.clientX, y: event.clientY};
      hovered = false;
      suppressHover = false;
      update();
    }, 200);
  });
  substitution.addEventListener('click', toggle);
  substitution.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    } else if (event.key === 'Escape') {
      cancelHoverTimer();
      locked = false;
      suppressHover = true;
      update();
    }
  });
  update();
});
