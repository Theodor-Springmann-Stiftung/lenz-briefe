// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

import { printStatus } from './print-status';

const button = document.querySelector<HTMLButtonElement>('[data-print-letter]');
const status = printStatus(document.querySelector<HTMLElement>('[data-print-status]'));

button?.addEventListener('click', async () => {
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  status.start('Druck wird vorbereitet …');
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
    await printHtml(html, title, status.hide, 90_000, status.progress);
  } catch (error) {
    console.error('Letter print failed', error);
    status.error('Druck konnte nicht vorbereitet werden. Bitte erneut versuchen.');
  } finally {
    status.stop();
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
});

export {};
