import tippy, { hideAll, type Instance } from 'tippy.js';

const instances = new WeakMap<HTMLElement, Instance>();

export function initializeTooltips(root: ParentNode = document) {
  const elements = [...root.querySelectorAll<HTMLElement>('[data-tooltip]')].filter(element => !instances.has(element));
  for (const element of elements) {
    element.removeAttribute('title');
    element.removeAttribute('aria-describedby');
  }
  for (const instance of tippy(elements, {
    content: reference => reference.getAttribute('data-tooltip') || '',
    theme: 'edition',
    maxWidth: 'calc(100vw - 32px)',
    arrow: true,
    popperOptions: {
      modifiers: [
        { name: 'flip', options: { fallbackPlacements: ['top', 'bottom', 'left', 'right'], padding: 16 } },
        { name: 'preventOverflow', options: { padding: 16 } },
      ],
    },
    trigger: 'mouseenter focus click',
    animation: false,
    duration: 0,
    offset: [0, 8],
    interactive: true,
    onShow(instance) {
      const target = instance.reference.getAttribute('popovertarget');
      if (target && document.getElementById(target)?.matches(':popover-open')) return false;
    },
    appendTo: () => document.body,
    aria: { content: 'describedby', expanded: false },
  })) instances.set(instance.reference as HTMLElement, instance);
}

export function destroyTooltips(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[data-tooltip]').forEach(element => {
    instances.get(element)?.destroy();
    instances.delete(element);
  });
}

initializeTooltips();

document.getElementById('quick-legend')?.addEventListener('beforetoggle', event => {
  if ((event as ToggleEvent).newState !== 'open') return;
  const button = document.querySelector<HTMLElement>('.quick-legend-toggle');
  if (button) instances.get(button)?.hide();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') hideAll({ duration: 0 });
});
document.addEventListener('catalog:change', () => hideAll({ duration: 0 }));
