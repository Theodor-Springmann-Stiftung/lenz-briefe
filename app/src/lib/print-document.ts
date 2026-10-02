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
  html.querySelectorAll('script, iframe, [data-tippy-root], link').forEach((node) => node.remove());
  html.querySelectorAll('[autofocus]').forEach((node) => node.removeAttribute('autofocus'));
  // Desktop layout shares page-number rows with rotation labels. The page
  // margin is hidden in print, so return each label to its original text block.
  for (const layout of html.querySelectorAll('[data-reading-layout]')) {
    for (const label of layout.querySelectorAll<HTMLElement>('.page-margin .tr-label[data-rotation-block]')) {
      const block = [...layout.querySelectorAll<HTMLElement>('div.tr[data-rotation-block]')]
        .find((candidate) => candidate.dataset.rotationBlock === label.dataset.rotationBlock);
      block?.prepend(label);
    }
  }
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
