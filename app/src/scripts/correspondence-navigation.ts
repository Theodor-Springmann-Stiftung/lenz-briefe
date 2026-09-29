import { selectCorrespondence } from '../lib/correspondence.mjs';

interface CorrespondenceOption {
  ref: string;
  name: string;
  catalogUrl: string;
  previous: string | null;
  next: string | null;
}

for (const navigation of document.querySelectorAll<HTMLElement>('[data-correspondence-options]')) {
  const options: CorrespondenceOption[] = JSON.parse(navigation.dataset.correspondenceOptions!);
  const select = navigation.querySelector('select');
  const name = navigation.querySelector<HTMLElement>('[data-correspondent-name]')!;
  const list = navigation.querySelector<HTMLAnchorElement>('[data-correspondence-list]')!;
  const previous = navigation.querySelector<HTMLAnchorElement>('[data-correspondence-previous]')!;
  const next = navigation.querySelector<HTMLAnchorElement>('[data-correspondence-next]')!;

  function update() {
    const requested = new URL(window.location.href).searchParams.get('correspondent');
    const selected = selectCorrespondence(options, requested);
    if (!selected) return;
    if (select) select.value = selected.ref;
    name.textContent = selected.name;
    list.href = selected.catalogUrl;
    list.setAttribute('aria-label', `Briefe mit ${selected.name} im Verzeichnis anzeigen`);
    for (const [link, href, direction] of [
      [previous, selected.previous, 'Vorheriger'],
      [next, selected.next, 'Nächster'],
    ] as const) {
      link.hidden = !href;
      if (href) link.href = href;
      else link.removeAttribute('href');
      link.setAttribute('aria-label', `${direction} Brief der Korrespondenz mit ${selected.name}`);
    }
  }

  select?.addEventListener('change', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('correspondent', select.value);
    window.history.replaceState(window.history.state, '', url);
    update();
    select.blur();
  });
  window.addEventListener('popstate', update);
  window.addEventListener('pageshow', update);
  update();
}
