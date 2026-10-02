// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

import { printDocument } from './print-document';

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
  const documents: Document[] = new Array(letters.length);
  const controller = new AbortController();
  let next = 0;
  let loaded = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(4, letters.length) }, async () => {
      while (next < letters.length) {
        const index = next++;
        const response = await fetch(letters[index].url, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
        });
        if (!response.ok) throw new Error(`LKB ${letters[index].id}: HTTP ${response.status}`);
        documents[index] = new DOMParser().parseFromString(await response.text(), 'text/html');
        controller.signal.throwIfAborted();
        if (!documents[index].querySelector('.letter-content .letter-body')) {
          throw new Error(`LKB ${letters[index].id}: Missing letter text`);
        }
        onProgress(++loaded);
      }
    }));
  } catch (error) {
    controller.abort();
    throw error;
  }

  const copy = new DOMParser().parseFromString(source.documentElement.outerHTML, 'text/html');
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
  main.append(cover);

  const today = new Date();
  const accessDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(today);
  const accessIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  documents.forEach((letter, position) => {
    const item = letters[position];
    const section = copy.createElement('section');
    section.className = 'selection-letter';
    section.id = `print-letter-${item.id}`;
    // Each letter assigns hand fonts independently. Scope those styles to its
    // section, so a writer's role in another letter cannot change this one.
    for (const style of letter.querySelectorAll('main style')) {
      const scoped = copy.createElement('style');
      scoped.textContent = style.textContent!.replaceAll('.letter-content', `#${section.id} .letter-content`);
      section.append(scoped);
    }
    const content = copy.importNode(letter.querySelector('.letter-content')!, true);
    const apparatus = letter.querySelector('.letter-footer-extension > .apparatus');
    if (apparatus) content.append(copy.importNode(apparatus, true));
    // IDs and local references belong to each source letter; make them unique
    // in the combined document, including apparatus and page anchors.
    const ids = new Map<string, string>();
    content.querySelectorAll<HTMLElement>('[id]').forEach((element) => {
      const old = element.id;
      element.id = `${section.id}-${old}`;
      ids.set(old, element.id);
    });
    content.querySelectorAll<HTMLElement>('[href], [src], [aria-labelledby], [aria-describedby]').forEach((element) => {
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
    });
    content.querySelectorAll<HTMLTimeElement>('[data-citation-access]').forEach((element) => {
      element.textContent = accessDate;
      element.dateTime = accessIso;
    });
    section.append(content);
    main.append(section);

    const row = copy.createElement('li');
    const link = copy.createElement('a');
    link.href = `#${section.id}`;
    link.textContent = letter.title;
    const date = letter.querySelector('.letter-date-text')?.textContent?.replace(/\s+/g, ' ').trim();
    if (date) {
      const detail = copy.createElement('span');
      detail.className = 'selection-index-date';
      detail.textContent = date;
      link.append(detail);
    }
    row.append(link);
    indexList.append(row);
  });
  return printDocument(copy);
}
