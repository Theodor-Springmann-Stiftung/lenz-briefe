// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

/** Vivliostyle treats flex containers as atomic. Give each visual tab row an
 * explicit table row so its cells can fragment at internal line boundaries.
 * Rows have independent column grids, just like their screen flex layouts.
 */
export function preparePrintTabs(document: Document): void {
  for (const row of document.querySelectorAll<HTMLElement>('.tabs > .lb-tab-row')) {
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
      // Floated hand labels must reach the letter's right margin, rather than
      // the edge of this narrower cell. Use the full print width, independent
      // of the cell's content width and padding.
      const remaining = Math.max(0, 100 - used - occupied);
      cell.style.setProperty('--print-tab-hand-shift', `calc(var(--print-letter-text-width) * ${remaining / 100} + var(--print-tab-label-padding))`);
      cell.append(...node.childNodes);
      cells!.append(cell);
      used += occupied;
    }
    row.replaceChildren(fragment);
  }
}
