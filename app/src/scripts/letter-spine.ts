const letter = document.querySelector<HTMLElement>('.letter-content');
const header = letter?.querySelector<HTMLElement>('.detail-header');
const footer = letter?.querySelector<HTMLElement>('.apparatus');
const body = letter?.querySelector<HTMLElement>('.letter-body');
const spine = letter?.querySelector<HTMLElement>('.letter-spine');

if (letter && header && footer && body && spine) {
  const container = letter, top = header, bottom = footer, text = body, line = spine;
  let scheduled = false;
  function position() {
    scheduled = false;
    const bounds = container.getBoundingClientRect();
    const headerBounds = top.getBoundingClientRect();
    const footerBounds = bottom.getBoundingClientRect();
    const textBounds = text.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
    line.style.left = `${textBounds.left - bounds.left - gap / 2}px`;
    line.style.top = `${headerBounds.bottom - bounds.top}px`;
    line.style.height = `${Math.max(0, footerBounds.top - headerBounds.bottom)}px`;
    const ticks = [...container.querySelectorAll<HTMLElement>('.page-number a')].map(number => {
      const bounds = number.getBoundingClientRect();
      const tick = document.createElement('span');
      tick.className = 'letter-spine-tick';
      tick.style.top = `${bounds.top + bounds.height / 2 - headerBounds.bottom}px`;
      return tick;
    });
    line.replaceChildren(...ticks);
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(position);
  }
  const observer = new ResizeObserver(schedule);
  [container, top, bottom, text].forEach(element => observer.observe(element));
  window.addEventListener('resize', schedule);
  document.addEventListener('margins:arranged', schedule);
  document.fonts.ready.then(schedule);
  schedule();
}
