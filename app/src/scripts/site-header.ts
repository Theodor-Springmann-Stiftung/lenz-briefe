const header = document.querySelector<HTMLElement>('.site-header');
if (header) {
  const updateHeight = () => document.documentElement.style.setProperty('--site-header-height', `${header.getBoundingClientRect().height}px`);
  new ResizeObserver(updateHeight).observe(header);
  updateHeight();
}

export {};
