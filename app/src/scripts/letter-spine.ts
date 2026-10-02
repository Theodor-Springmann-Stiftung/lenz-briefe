import { registerLayoutTask } from './reading-layout';

const letter = document.querySelector<HTMLElement>('.letter-content');
const header = letter?.querySelector<HTMLElement>('.reading-toolbar');
const footer = document.querySelector<HTMLElement>('.apparatus');
const body = letter?.querySelector<HTMLElement>('.letter-body');
const spine = letter?.querySelector<HTMLElement>('.letter-spine');

if (letter && header && footer && body && spine) {
  const container = letter,
    top = header,
    bottom = footer,
    text = body,
    line = spine;
  function position() {
    const bounds = container.getBoundingClientRect();
    const headerBounds = top.getBoundingClientRect();
    const footerBounds = bottom.getBoundingClientRect();
    const textBounds = text.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
    const ticks = [...container.querySelectorAll<HTMLElement>('.page-number a')].map((number) => {
      const bounds = number.getBoundingClientRect();
      const tick = document.createElement('span');
      tick.className = 'letter-spine-tick';
      tick.style.top = `${bounds.top + bounds.height / 2 - headerBounds.bottom}px`;
      return tick;
    });
    return () => {
      line.style.left = `${textBounds.left - bounds.left - gap / 2}px`;
      line.style.top = `${headerBounds.bottom - bounds.top}px`;
      line.style.height = `${Math.max(0, footerBounds.top - headerBounds.bottom)}px`;
      line.replaceChildren(...ticks);
    };
  }
  registerLayoutTask(position, { observe: [container, top, bottom, text] });
}
