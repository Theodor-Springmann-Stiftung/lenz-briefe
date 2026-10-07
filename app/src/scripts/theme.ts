const toggle = document.querySelector<HTMLInputElement>('.theme-toggle');
if (toggle) {
  const setDark = (dark: boolean) => {
    document.documentElement.toggleAttribute('data-dark', dark);
    toggle.checked = dark;
  };
  const restore = () => {
    try {
      setDark(localStorage.getItem('lenz-theme') === 'dark');
    } catch {
      setDark(document.documentElement.hasAttribute('data-dark'));
    }
  };
  restore();
  toggle.closest<HTMLElement>('.theme-control')!.hidden = false;
  toggle.addEventListener('change', () => {
    const dark = toggle.checked;
    setDark(dark);
    try { localStorage.setItem('lenz-theme', dark ? 'dark' : 'light'); } catch { /* The toggle still works without storage. */ }
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) restore();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === 'lenz-theme' || event.key === null) restore();
  });
}
