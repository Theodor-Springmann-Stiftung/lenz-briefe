// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

import { handLabelNames } from './hand-label-groups.mjs';
import { handTextNodes } from './hand-text';

interface HandLine { anchors: HTMLElement[]; refs: Set<string>; }

/** Source line breaks survive print reflow. In tables, corresponding lines in
 * neighbouring cells share a label; later lines keep their own anchors. */
function handLines(root: HTMLElement, textHands: Map<Node, string>): HandLine[] {
  const result: HandLine[] = [];
  function scan(container: Element, lines: Map<number, HandLine>) {
    let line = 0;
    let hasText = false;
    let breakBefore = false;
    const startLine = () => {
      if (breakBefore) {
        line++;
        hasText = false;
        breakBefore = false;
      }
      if (!lines.has(line)) lines.set(line, { anchors: [], refs: new Set() });
      return lines.get(line)!;
    };
    function visit(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent?.trim()) {
          const entry = startLine();
          const ref = textHands.get(node);
          if (ref) entry.refs.add(ref);
          hasText = true;
        }
        return;
      }
      if (!(node instanceof HTMLElement)) return;
      if (node.matches('.print-tab-table')) {
        for (const row of (node as HTMLTableElement).rows) {
          const rowLines = new Map<number, HandLine>();
          for (const cell of row.cells) scan(cell, rowLines);
          result.push(...rowLines.values());
        }
        breakBefore = true;
        return;
      }
      if (node.tagName === 'BR') {
        line++;
        hasText = false;
        breakBefore = false;
        return;
      }
      const block = node.tagName === 'DIV' || node.tagName === 'P';
      if (block && hasText) breakBefore = true;
      if (node.matches(':is(.hand, .hand-base-start)[data-hand-name]')) {
        startLine().anchors.push(node);
      }
      for (const child of node.childNodes) visit(child);
      if (block && hasText) breakBefore = true;
    }
    for (const child of container.childNodes) visit(child);
  }
  const lines = new Map<number, HandLine>();
  scan(root, lines);
  result.push(...lines.values());
  return result.filter(({ anchors }) => anchors.length);
}

/** Pair each transcription block with its hand labels in a paginatable table.
 * The original text blocks retain their alignment, IDs and inline markup. */
export function preparePrintHandColumns(document: Document): void {
  for (const body of document.querySelectorAll<HTMLElement>('.letter-body')) {
    const baseRef = body.closest<HTMLElement>('[data-base-hand]')?.dataset.baseHand;
    const names = new Map([...body.querySelectorAll<HTMLElement>('[data-hand-name]')].map((hand) => [
      hand.dataset.ref || baseRef, hand.dataset.handName!,
    ]));
    const textHands = new Map<Node, string>(handTextNodes(body, baseRef).map(({ node, ref }) => [node, ref]));
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
      for (const { anchors: hands, refs } of handLines(text, textHands)) {
        const name = handLabelNames([
          ...[...refs].flatMap((ref) => names.has(ref) ? [names.get(ref)!] : []),
          ...hands.map((hand) => hand.dataset.handName!),
        ]).join(', ');
        const hand = hands[0];
        for (const anchor of hands) anchor.removeAttribute('data-hand-name');
        // A source table can contain many hand changes on different lines in
        // the same cell. Retain those inline anchors instead of stacking all
        // names beside the table's first line.
        if (hand.closest('.print-tab-table')) {
          hand.dataset.handName = name;
          continue;
        }
        const label = document.createElement('span');
        label.textContent = name;
        labels.append(label);
      }
    }
    body.replaceChildren(table);
  }
}
