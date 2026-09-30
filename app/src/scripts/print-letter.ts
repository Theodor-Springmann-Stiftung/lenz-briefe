// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

const button = document.querySelector<HTMLButtonElement>('[data-print-letter]');
const status = document.querySelector<HTMLElement>('[data-print-status]');

button?.addEventListener('click', async () => {
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  if (status) {
    status.hidden = false;
    status.textContent = 'Druck wird vorbereitet …';
  }
  try {
    // Download the typesetter only when requested; the offline build caches this
    // chunk along with the other assets. printHTML waits for full pagination.
    const [{ printHTML }, { printDocument }] = await Promise.all([
      import('@vivliostyle/core'),
      import('../lib/print-document'),
    ]);
    window.dispatchEvent(new Event('beforeprint'));
    const html = printDocument(document);
    const title = document.title;
    await new Promise<void>((resolve, reject) => {
      const existingFrames = new Set(document.querySelectorAll('iframe'));
      let frame: HTMLIFrameElement | undefined;
      let finished = false;
      const timeout = window.setTimeout(() => finish(new Error('Print preparation timed out')), 90_000);
      function finish(error?: Error) {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        frame?.remove();
        if (error) reject(error);
        else resolve();
      }
      printHTML(html, {
        // printHTML interpolates this initial title into iframe markup. Set the
        // actual editorial title through the DOM once the pages are ready.
        title: 'Lenz Briefe',
        hideIframe: true,
        // Some browsers return from print() before the dialog closes. Retain
        // the prepared pages until afterprint, including when it is cancelled.
        removeIframe: false,
        errorCallback: (message) => finish(new Error(message)),
        printCallback: (printWindow) => {
          if (finished) return;
          window.clearTimeout(timeout);
          if (status) status.hidden = true;
          printWindow.document.title = title;
          // Vivliostyle caps pages at 100vh. Firefox resolves that against the
          // hidden iframe and clips the bottom margin on single-page prints.
          // Match our A4 page height. Reset the library's negative native page
          // margins, which make Firefox insert a blank page after each sheet.
          // Chromium uses Vivliostyle's zoom-based print layout, so these
          // Firefox adjustments must not affect its page dimensions.
          if (CSS.supports('-moz-appearance', 'none')) {
            const pageHeight = printWindow.document.createElement('style');
            pageHeight.textContent = '@media print { @page { margin:0; } [data-vivliostyle-page-container] { max-height:297mm !important; } }';
            printWindow.document.head.append(pageHeight);
            // The visible footer is already in the last page's margin. Its hidden
            // source placeholder can make Firefox shrink the whole printout.
            printWindow.document.querySelectorAll('.site-footer').forEach((footer) => {
              if (printWindow.getComputedStyle(footer).visibility === 'hidden') footer.remove();
            });
          }
          printWindow.addEventListener('afterprint', () => finish(), { once: true });
          try {
            printWindow.focus();
            printWindow.print();
          } catch (error) {
            finish(error instanceof Error ? error : new Error(String(error)));
          }
        },
      });
      frame = [...document.querySelectorAll('iframe')].find((element) => !existingFrames.has(element));
    });
  } catch (error) {
    console.error('Letter print failed', error);
    if (status) {
      status.hidden = false;
      status.textContent = 'Druck konnte nicht vorbereitet werden. Bitte erneut versuchen.';
    }
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
});

export {};
