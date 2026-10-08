import { registerLayoutTask } from './reading-layout';

const layout = document.querySelector<HTMLElement>('[data-reading-layout]');
if (layout) {
  const figures = [...layout.querySelectorAll<HTMLElement>('[data-letter-image]')];
  if (figures.length) {
    registerLayoutTask(() => {
      const bounds = layout.getBoundingClientRect();
      // Keep the page-number margin clear; extend only into the right margin.
      const body = layout.querySelector<HTMLElement>('.letter-body')!.getBoundingClientRect();
      return () => {
        for (const figure of figures) {
          figure.style.setProperty('--letter-image-width', `${bounds.right - body.left}px`);
        }
      };
    }, { observe: [layout] });
  }
}
