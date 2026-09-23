import tippy, { hideAll } from 'tippy.js';

tippy('[data-tooltip]', {
  content: reference => reference.getAttribute('data-tooltip') || '',
  theme: 'edition',
  trigger: 'mouseenter focus click',
  animation: false,
  duration: 0,
  offset: [0, 8],
  interactive: true,
  appendTo: () => document.body,
  aria: { content: 'describedby', expanded: false },
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') hideAll({ duration: 0 });
});
document.addEventListener('catalog:change', () => hideAll({ duration: 0 }));
