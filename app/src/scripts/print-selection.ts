// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

import type { SelectionLetter, SelectionInfo } from '../lib/print-selection-document';

/** The catalogue supplies a snapshot of its current rows and filter labels. */
export function setupSelectionPrint(selection: () => { letters: SelectionLetter[]; info: SelectionInfo }) {
  const button = document.querySelector<HTMLButtonElement>('[data-print-selection]')!;
  const status = document.querySelector<HTMLElement>('[data-selection-print-status]')!;
  button.addEventListener('click', async () => {
    const { letters, info } = selection();
    if (!letters.length) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    status.hidden = false;
    status.classList.add('is-preparing');
    status.textContent = `Briefe werden geladen … 0/${letters.length}`;
    try {
      const [{ printHtml }, { printSelectionDocument }] = await Promise.all([
        import('../lib/print-html'),
        import('../lib/print-selection-document'),
      ]);
      const html = await printSelectionDocument(document, letters, info, (loaded) => {
        status.textContent = `Briefe werden geladen … ${loaded}/${letters.length}`;
      });
      status.textContent = 'Druck wird vorbereitet …';
      await printHtml(html, 'Briefauswahl – Lenz Briefe', () => { status.hidden = true; }, Math.max(90_000, letters.length * 2_000));
    } catch (error) {
      console.error('Selection print failed', error);
      status.hidden = false;
      status.textContent = 'Auswahl konnte nicht zum Druck vorbereitet werden. Bitte erneut versuchen.';
    } finally {
      status.classList.remove('is-preparing');
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  });
}
