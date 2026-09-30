// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

const button = document.querySelector<HTMLButtonElement>('[data-print-letter]');
const status = document.querySelector<HTMLElement>('[data-print-status]');

button?.addEventListener('click', async () => {
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  if (status) {
    status.hidden = false;
    status.classList.add('is-preparing');
    status.textContent = 'Druck wird vorbereitet …';
  }
  try {
    // Download the typesetter only when requested; the offline build caches this
    // chunk along with the other assets. printHTML waits for full pagination.
    const [{ printHtml }, { printDocument }] = await Promise.all([
      import('../lib/print-html'),
      import('../lib/print-document'),
    ]);
    window.dispatchEvent(new Event('beforeprint'));
    const html = printDocument(document);
    const title = document.title;
    await printHtml(html, title, () => {
      if (status) status.hidden = true;
    });
  } catch (error) {
    console.error('Letter print failed', error);
    if (status) {
      status.hidden = false;
      status.textContent = 'Druck konnte nicht vorbereitet werden. Bitte erneut versuchen.';
    }
  } finally {
    status?.classList.remove('is-preparing');
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
});

export {};
