// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

import { printSnapshot, preparePrintContent, finishPrintDocument } from './print-document';
import { createPrintEditionLink } from './print-edition-link';
import { printCheckpoint } from './print-work.mjs';

export interface SelectionLetter { id: string; url: string; }
export interface SelectionInfo { description: string; period: string; }

/** Fetch complete letter pages without executing their scripts. Fail as a whole
 * rather than silently printing a selection with missing letters. */
export async function printSelectionDocument(
  source: Document,
  letters: SelectionLetter[],
  info: SelectionInfo,
  onProgress: (loaded: number) => void,
): Promise<string> {
  if (!letters.length) throw new Error('Empty print selection');
  const checkpoint = printCheckpoint();
  await checkpoint(true);
  const copy = printSnapshot(source, true);
  await preparePrintContent(copy, checkpoint);
  const base = copy.createElement('base');
  base.href = source.baseURI;
  copy.head.querySelector('base')?.remove();
  copy.head.prepend(base);
  copy.title = 'Briefauswahl';
  const main = copy.querySelector('body > main')!;
  main.classList.add('print-selection');
  main.replaceChildren();
  const cover = copy.createElement('section');
  cover.className = 'selection-cover';
  const addText = (tag: string, value: string) => {
    const element = copy.createElement(tag);
    element.textContent = value;
    cover.append(element);
  };
  addText('h1', 'Inhaltsverzeichnis');
  addText('h2', info.description || info.period);
  const indexList = copy.createElement('ol');
  indexList.className = 'selection-index';
  cover.append(indexList);
  cover.append(createPrintEditionLink(copy));
  main.append(cover);

  // Ordered placeholders let four fetch/preparation workers finish in any
  // order without keeping every complete source page alive until assembly.
  const sections: HTMLElement[] = [];
  const links: HTMLAnchorElement[] = [];
  for (const item of letters) {
    const section = copy.createElement('section');
    section.className = 'selection-letter';
    section.id = `print-letter-${item.id}`;
    main.append(section);
    sections.push(section);
    const row = copy.createElement('li');
    const link = copy.createElement('a');
    link.href = `#${section.id}`;
    row.append(link);
    indexList.append(row);
    links.push(link);
  }

  const controller = new AbortController();
  let next = 0;
  let loaded = 0;
  const prepareLetter = async (position: number) => {
    const item = letters[position];
    const section = sections[position];
    const response = await fetch(item.url, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
    });
    if (!response.ok) throw new Error(`LKB ${item.id}: HTTP ${response.status}`);
    const letter = new DOMParser().parseFromString(await response.text(), 'text/html');
    controller.signal.throwIfAborted();
    const content = letter.querySelector<HTMLElement>('.letter-content');
    if (!content?.querySelector('.letter-body')) throw new Error(`LKB ${item.id}: Missing letter text`);
    const title = content.dataset.letterTitle || `Brief ${item.id}`;
    const date = letter.querySelector('.letter-date-text')?.textContent?.replace(/\s+/g, ' ').trim();
    // Each letter assigns hand fonts independently. Scope those styles to its
    // section, so a writer's role in another letter cannot change this one.
    for (const style of letter.querySelectorAll('main style')) {
      const scoped = copy.createElement('style');
      scoped.textContent = style.textContent!.replaceAll('.letter-content', `#${section.id} .letter-content`);
      section.append(scoped);
    }
    // IDs and local references belong to each source letter; make them unique
    // in the combined document, including apparatus and page anchors.
    const ids = new Map<string, string>();
    for (const element of content.querySelectorAll<HTMLElement>('[id]')) {
      const old = element.id;
      element.id = `${section.id}-${old}`;
      ids.set(old, element.id);
      const pause = checkpoint(); if (pause) await pause;
    }
    for (const element of content.querySelectorAll<HTMLElement>('[href], [src], [aria-labelledby], [aria-describedby]')) {
      for (const attribute of ['href', 'src']) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        element.setAttribute(attribute, value.startsWith('#') && ids.has(value.slice(1))
          ? `#${ids.get(value.slice(1))}` : new URL(value, item.url).href);
      }
      for (const attribute of ['aria-labelledby', 'aria-describedby']) {
        const value = element.getAttribute(attribute);
        if (value) element.setAttribute(attribute, value.split(/\s+/).map((id) => ids.get(id) || id).join(' '));
      }
      const pause = checkpoint(); if (pause) await pause;
    }
    // Move the owned subtree instead of cloning it. The rest of the fetched
    // page can be collected as soon as this worker proceeds to its next letter.
    section.append(copy.adoptNode(content));
    await preparePrintContent(content, checkpoint);
    controller.signal.throwIfAborted();
    const link = links[position];
    link.textContent = title;
    if (date) {
      const detail = copy.createElement('span');
      detail.className = 'selection-index-date';
      detail.textContent = date;
      link.append(detail);
    }
    onProgress(++loaded);
  };
  try {
    await Promise.all(Array.from({ length: Math.min(4, letters.length) }, async () => {
      while (next < letters.length) {
        controller.signal.throwIfAborted();
        await prepareLetter(next++);
      }
    }));
  } catch (error) {
    controller.abort();
    throw error;
  }
  const today = new Date();
  const accessDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(today);
  const accessIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  for (const element of copy.querySelectorAll<HTMLTimeElement>('.selection-letter [data-citation-access]')) {
    element.textContent = accessDate;
    element.dateTime = accessIso;
    const pause = checkpoint(); if (pause) await pause;
  }
  return finishPrintDocument(copy, source.baseURI, checkpoint);
}
