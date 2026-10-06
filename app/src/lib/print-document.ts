// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

import screenStyles from '../styles/global.css?inline';
import printStyles from '../styles/print.css?inline';
import { preparePrintTabs } from './print-tabs';
import { preparePrintHandColumns } from './print-hands';
import { createPrintEditionLink } from './print-edition-link';
import { printCheckpoint } from './print-work.mjs';

export type PrintCheckpoint = ReturnType<typeof printCheckpoint>;

/** Clone DOM directly rather than serializing and parsing it. A selection only
 * needs the catalogue's shell; omit its large list before any deep copying. */
export function printSnapshot(source: Document, emptyMain = false): Document {
  if (!emptyMain) return source.cloneNode(true) as Document;
  const copy = source.cloneNode(false) as Document;
  const html = copy.importNode(source.documentElement, false);
  copy.append(html);
  for (const node of source.documentElement.childNodes) {
    if (node !== source.body) { html.append(copy.importNode(node, true)); continue; }
    const body = copy.importNode(source.body, false);
    html.append(body);
    for (const child of source.body.childNodes) {
      body.append(copy.importNode(child, !(child instanceof HTMLElement && child.tagName === 'MAIN')));
    }
  }
  return copy;
}

/** Snapshot the current letter, including hand fonts and the current access date.
 * A base URL keeps local fonts, images and links working in the blob document.
 * Scripts and live popovers never run inside the printable copy.
 */
export async function printDocument(source: Document): Promise<string> {
  const checkpoint = printCheckpoint();
  await checkpoint(true);
  const copy = printSnapshot(source);
  await preparePrintContent(copy, checkpoint);
  return finishPrintDocument(copy, source.baseURI, checkpoint);
}

/** Transform an owned, detached letter before it joins the selection. */
export async function preparePrintContent(root: ParentNode, checkpoint: PrintCheckpoint): Promise<void> {
  for (const node of root.querySelectorAll('script, iframe, [data-tippy-root], link, .letter-route-map, .place-map-control')) {
    node.remove();
    const pause = checkpoint(); if (pause) await pause;
  }
  for (const node of root.querySelectorAll('[autofocus]')) node.removeAttribute('autofocus');
  // Desktop layout shares page-number rows with rotation labels. The page
  // margin is hidden in print, so return each label to its original text block.
  for (const layout of root.querySelectorAll('[data-reading-layout]')) {
    const blocks = new Map<string | undefined, HTMLElement>();
    for (const block of layout.querySelectorAll<HTMLElement>('div.tr[data-rotation-block]')) {
      if (!blocks.has(block.dataset.rotationBlock)) blocks.set(block.dataset.rotationBlock, block);
    }
    for (const label of layout.querySelectorAll<HTMLElement>('.page-margin .tr-label[data-rotation-block]')) {
      blocks.get(label.dataset.rotationBlock)?.prepend(label);
    }
    const pause = checkpoint(); if (pause) await pause;
  }
  await preparePrintTabs(root, checkpoint);
  await preparePrintHandColumns(root, checkpoint);
}

/** Finish an already prepared document in place. The selection is serialized
 * once, without another full-document copy or another round of transformations. */
export async function finishPrintDocument(copy: Document, baseURL: string, checkpoint: PrintCheckpoint): Promise<string> {
  const html = copy.documentElement;
  if (copy.querySelector('.letter-content')) {
    copy.querySelector('.site-footer')?.prepend(createPrintEditionLink(copy));
    html.classList.add('print-with-edition-link');
  }
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
  base.href = baseURL;
  head.prepend(base);
  const pause = checkpoint(); if (pause) await pause;
  return `<!doctype html>\n${html.outerHTML}`;
}
