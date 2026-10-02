const header = document.querySelector<HTMLElement>('.site-header');
if (header) {
  const extension = header.querySelector<HTMLElement>('.letter-menu-extension');
  const updateHeight = () => {
    document.documentElement.style.setProperty(
      '--site-header-extension-height',
      `${extension?.getBoundingClientRect().height ?? 0}px`,
    );
    document.documentElement.style.setProperty(
      '--site-header-height',
      `${header.getBoundingClientRect().height}px`,
    );
  };
  new ResizeObserver(updateHeight).observe(header);
  updateHeight();

  const toggle = header.querySelector<HTMLButtonElement>('.navigation-toggle');
  const navigation = header.querySelector<HTMLElement>('.main-navigation');
  if (toggle && navigation) {
    const mobile = window.matchMedia('(max-width: 959px)');
    const setOpen = (open: boolean) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
      header.toggleAttribute('data-menu-open', open);
      if (!open)
        navigation.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((menu) => {
          menu.open = false;
        });
    };
    header.setAttribute('data-menu-ready', '');
    toggle.addEventListener('click', () =>
      setOpen(toggle.getAttribute('aria-expanded') !== 'true'),
    );
    header.addEventListener('keydown', (event) => {
      if (
        event.key === 'Escape' &&
        mobile.matches &&
        toggle.getAttribute('aria-expanded') === 'true'
      ) {
        setOpen(false);
        toggle.focus();
        event.preventDefault();
      }
    });
    document.addEventListener('click', (event) => {
      if (event.target instanceof Node && !header.contains(event.target)) setOpen(false);
    });
    header.addEventListener('focusout', (event) => {
      if (event.relatedTarget instanceof Node && !header.contains(event.relatedTarget))
        setOpen(false);
    });
    navigation.addEventListener('click', (event) => {
      if (mobile.matches && event.target instanceof Element && event.target.closest('a[href]'))
        setOpen(false);
    });
    mobile.addEventListener('change', () => {
      const focused = document.activeElement;
      setOpen(false);
      if (mobile.matches && focused && navigation.contains(focused)) toggle.focus();
      else if (!mobile.matches && focused === toggle)
        navigation.querySelector<HTMLElement>('a[href], summary')?.focus();
    });
  }
}

export {};
