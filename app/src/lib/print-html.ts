// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

import { printHTML, HOOKS, registerHook, removeHook } from '@vivliostyle/core';
import { printTimeout, printWatchdog } from './print-timeout.mjs';

export interface PrintProgress { fraction: number; pages: number; }

/** Paginate a prepared document and retain it until the print dialog closes. */
export async function printHtml(html: string, title: string, onReady: () => void, timeoutMs = printTimeout(), onProgress?: (progress: PrintProgress) => void): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const existingFrames = new Set(document.querySelectorAll('iframe'));
    let frame: HTMLIFrameElement | undefined;
    let finished = false;
    const watchdog = printWatchdog(timeoutMs, () => finish(new Error('Print preparation stopped making progress')));
    const progress = (payload: PrintProgress) => {
      if (finished) return;
      watchdog.progress(payload);
      onProgress?.(payload);
    };
    registerHook(HOOKS.PAGINATION_PROGRESS, progress);
    const removeProgress = () => removeHook(HOOKS.PAGINATION_PROGRESS, progress);
    function finish(error?: Error) {
      if (finished) return;
      finished = true;
      watchdog.stop();
      removeProgress();
      frame?.remove();
      if (error) reject(error);
      else resolve();
    }
    try {
      printHTML(html, {
        // printHTML interpolates this initial title into iframe markup. Set the
        // actual editorial title through the DOM once the pages are ready.
        title: 'Druckansicht',
        hideIframe: true,
        // Some browsers return from print() before the dialog closes. Retain
        // the prepared pages until afterprint, including when it is cancelled.
        removeIframe: false,
        errorCallback: (message) => finish(new Error(message)),
        printCallback: (printWindow) => {
          if (finished) return;
          watchdog.stop();
          removeProgress();
          onReady();
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
      if (finished) frame?.remove();
    } catch (error) {
      frame = [...document.querySelectorAll('iframe')].find((element) => !existingFrames.has(element));
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
