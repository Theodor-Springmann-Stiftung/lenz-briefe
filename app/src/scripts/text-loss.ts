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
