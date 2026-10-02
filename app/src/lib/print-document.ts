// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

import screenStyles from '../styles/global.css?inline';
import printStyles from '../styles/print.css?inline';
import { preparePrintTabs } from './print-tabs';
import { preparePrintHandColumns } from './print-hands';

/** Snapshot the current letter, including hand fonts and the current access date.
 * A base URL keeps local fonts, images and links working in the blob document.
 * Scripts and live popovers never run inside the printable copy.
 */
export function printDocument(source: Document): string {
  const copy = new DOMParser().parseFromString(source.documentElement.outerHTML, 'text/html');
  const html = copy.documentElement;
  const apparatus = copy.querySelector('.letter-footer-extension > .apparatus');
  if (apparatus) copy.querySelector('.letter-content')?.append(apparatus);
  html.querySelectorAll('script, iframe, [data-tippy-root], link').forEach((node) => node.remove());
  html.querySelectorAll('[autofocus]').forEach((node) => node.removeAttribute('autofocus'));
  preparePrintTabs(copy);
  preparePrintHandColumns(copy);
  const head = html.querySelector('head')!;
  // Astro supplies local-only fallback faces for screen font loading.
  // The print copy uses the same self-hosted font files, with native fallbacks.
  for (const style of head.querySelectorAll('style')) {
    if (!style.textContent?.includes('@font-face')) continue;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(style.textContent);
    style.textContent = [...sheet.cssRules].filter((rule) => {
      if (!(rule instanceof CSSFontFaceRule)) return true;
      const src = rule.style.getPropertyValue('src');
      return !/\blocal\s*\(/i.test(src) || /\burl\s*\(/i.test(src);
    }).map((rule) => rule.cssText).join('\n');
  }
  // Use the compiled styles directly. This preserves paged-media rules that
  // native CSSOM serialization drops and avoids fetching stylesheets again.
  const styles = copy.createElement('style');
  styles.textContent = `${screenStyles}\n${printStyles}`;
  head.append(styles);
  head.querySelector('base')?.remove();
  const base = copy.createElement('base');
  base.href = source.baseURI;
  head.prepend(base);
  return `<!doctype html>\n${html.outerHTML}`;
}
