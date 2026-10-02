// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

/** Pair each transcription block with its hand labels in a paginatable table.
 * The original text blocks retain their alignment, IDs and inline markup. */
export function preparePrintHandColumns(document: Document): void {
  for (const body of document.querySelectorAll<HTMLElement>('.letter-body')) {
    const table = document.createElement('table');
    table.className = 'print-hand-table';
    table.setAttribute('role', 'presentation');
    const columns = document.createElement('colgroup');
    for (const name of ['print-text-col', 'print-hand-col']) {
      const column = document.createElement('col');
      column.className = name;
      columns.append(column);
    }
    table.append(columns);
    const rows = table.createTBody();
    for (const block of [...body.childNodes]) {
      if (block.nodeType === Node.TEXT_NODE && !block.textContent?.trim()) continue;
      const row = rows.insertRow();
      const text = row.insertCell();
      text.className = 'print-text-cell';
      text.append(block);
      const labels = row.insertCell();
      labels.className = 'print-hand-cell';
      for (const hand of text.querySelectorAll<HTMLElement>(':is(.hand, .hand-base-start)[data-hand-name]')) {
        // A source table can contain many hand changes on different lines in
        // the same cell. Retain those inline anchors instead of stacking all
        // names beside the table's first line.
        if (hand.closest('.print-tab-table')) continue;
        const label = document.createElement('span');
        label.textContent = hand.dataset.handName!;
        labels.append(label);
        hand.removeAttribute('data-hand-name');
      }
    }
    body.replaceChildren(table);
  }
}
