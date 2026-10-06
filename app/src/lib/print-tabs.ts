// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

import type { PrintCheckpoint } from './print-document';

/** Vivliostyle treats flex containers as atomic. Give each visual tab row an
 * explicit table row so its cells can fragment at internal line boundaries.
 * Rows have independent column grids, just like their screen flex layouts.
 */
export async function preparePrintTabs(root: ParentNode, checkpoint: PrintCheckpoint): Promise<void> {
  const document = root instanceof Document ? root : (root as Node).ownerDocument!;
  for (const row of root.querySelectorAll<HTMLElement>('.tabs > .lb-tab-row')) {
    const fragment = document.createDocumentFragment();
    let table: HTMLTableElement | undefined;
    let cells: HTMLTableRowElement | undefined;
    let used = 0;
    const startRow = () => {
      table = document.createElement('table');
      table.className = 'print-tab-table';
      cells = table.createTBody().insertRow();
      fragment.append(table);
      used = 0;
    };
    for (const node of [...row.childNodes]) {
      const pause = checkpoint(); if (pause) await pause;
      if (!(node instanceof HTMLElement) || !node.classList.contains('tab')) {
        // Prefixes and editorial content before the cells keep their original
        // full-width position. Whitespace between cells stays with the last cell.
        if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim() && cells?.lastElementChild) {
          cells.lastElementChild.append(node);
        } else {
          fragment.append(node);
          table = undefined;
          cells = undefined;
          used = 0;
        }
        continue;
      }
      const width = Number.parseFloat(node.style.getPropertyValue('--cell-width')) || 100;
      const gap = Number.parseFloat(node.style.getPropertyValue('--cell-gap')) || 0;
      const occupied = width + gap;
      // Some source rows contain repeated tab runs. Mirror flex wrapping rather
      // than squeezing those later runs into the same table's columns.
      if (!cells || used + occupied > 100.001) startRow();
      if (gap > 0) {
        const spacer = cells!.insertCell();
        spacer.className = 'print-tab-gap';
        spacer.style.width = `${gap}%`;
        spacer.setAttribute('aria-hidden', 'true');
      }
      const cell = document.createElement('td');
      for (const attribute of [...node.attributes]) cell.setAttribute(attribute.name, attribute.value);
      // Inline hand changes inside source tables still need to reach the
      // shared hand column, independent of the current cell's width.
      const remaining = Math.max(0, 100 - used - occupied);
      cell.style.setProperty('--print-tab-hand-shift', `calc(var(--print-letter-text-width) * ${remaining / 100} + var(--print-tab-label-padding))`);
      cell.append(...node.childNodes);
      cells!.append(cell);
      used += occupied;
    }
    row.replaceChildren(fragment);
  }
}
