// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

import { handLabelNames } from './hand-label-groups.mjs';
import { handTextNodeEntries } from './hand-text';
import type { PrintCheckpoint } from './print-document';

interface HandLine { anchors: HTMLElement[]; refs: Set<string>; }

/** Aligned lines and short plain source lines can form a stanza or closing.
 * Longer prose and blocks with multiple regions retain their own pagination. */
function sourceLineLayout(block: Node, text: string): string | undefined {
  if (!(block instanceof HTMLElement)
    || !block.matches('.lb-line-block:not(.lb-line-block--rule, .lb-line-block--note)')
    || !text) return;
  let alignment = 'align-left';
  if (block.dataset.layout === 'aligned') {
    if (block.children.length !== 1) return;
    const region = block.firstElementChild!;
    if (!region.matches('.align-left, .align-center, .align-right')) return;
    alignment = region.className;
  } else {
    // Plain <line/> blocks also encode verse and addresses. A modest text
    // bound excludes prose paragraphs without needing a second layout pass.
    if (text.length > 120
      || block.querySelector('div, p, table, br')) return;
  }
  return JSON.stringify([alignment, block.dataset.tab || '', block.style.getPropertyValue('--indent-units')]);
}

/** Original spacing can sit within a short closing; editorial gaps always
 * separate sections. Elsewhere, blank lines and spacing end a line group. */
function sourceLineSpacing(block: Node, text: string): number {
  if (!(block instanceof HTMLElement) || text) return 0;
  if (block.matches('.lb-vspace:not([data-presentational="true"])')) {
    return Number(block.dataset.lines) || 0;
  }
  return block.matches('.lb-line-block:not(.lb-line-block--rule, .lb-line-block--note)') ? 1 : 0;
}

/** Protect four opening and three closing lines within each uninterrupted run.
 * Spacing is the preferred break. A short right-aligned closing is the sole
 * exception: its salutation and signature can span original spacing. */
async function sourceLineKeeps(blocks: Node[], checkpoint: PrintCheckpoint): Promise<Set<number>> {
  const layouts: (string | undefined)[] = [];
  const spacing: number[] = [];
  const closings: boolean[] = [];
  for (const block of blocks) {
    const text = block.textContent?.replace(/\s+/g, ' ').trim() || '';
    layouts.push(sourceLineLayout(block, text));
    spacing.push(sourceLineSpacing(block, text));
    closings.push(block instanceof HTMLElement && !!block.firstElementChild?.matches('.align-right') && text.length <= 120);
    const pause = checkpoint(); if (pause) await pause;
  }
  const keeps = new Set<number>();
  for (let start = 0; start < layouts.length;) {
    if (!layouts[start]) { start++; continue; }
    let end = start + 1;
    while (end < layouts.length && layouts[end] === layouts[start]) end++;
    const lines = Array.from({ length: end - start }, (_, index) => start + index);
    const shortClosingLine = (index: number) => closings[index];
    let closingSpacing = 0;
    while (lines.length < 4 && lines.every(shortClosingLine)) {
      let next = end;
      let gap = 0;
      while (spacing[next]) { gap += spacing[next]; next++; }
      if (!gap || closingSpacing + gap > 3 || layouts[next] !== layouts[start]) break;
      let nextEnd = next + 1;
      while (nextEnd < layouts.length && layouts[nextEnd] === layouts[start]) nextEnd++;
      const following = Array.from({ length: nextEnd - next }, (_, index) => next + index);
      if (lines.length + following.length > 4 || !following.every(shortClosingLine)) break;
      lines.push(...following);
      closingSpacing += gap;
      end = nextEnd;
    }
    for (let line = 0; line < lines.length - 1; line++) {
      if (line < 3 || line >= lines.length - 3) {
        // Keep every row across the gap, including the spacing itself.
        for (let index = lines[line]; index < lines[line + 1]; index++) keeps.add(index);
      }
    }
    start = end;
    const pause = checkpoint(); if (pause) await pause;
  }
  return keeps;
}

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
export async function preparePrintHandColumns(root: ParentNode, checkpoint: PrintCheckpoint): Promise<void> {
  const document = root instanceof Document ? root : (root as Node).ownerDocument!;
  for (const body of root.querySelectorAll<HTMLElement>('.letter-body')) {
    const baseRef = body.closest<HTMLElement>('[data-base-hand]')?.dataset.baseHand;
    const names = new Map([...body.querySelectorAll<HTMLElement>('[data-hand-name]')].map((hand) => [
      hand.dataset.ref || baseRef, hand.dataset.handName!,
    ]));
    const textHands = new Map<Node, string>();
    for (const { node, ref } of handTextNodeEntries(body, baseRef)) {
      textHands.set(node, ref);
      const pause = checkpoint(); if (pause) await pause;
    }
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
    const blocks = [...body.childNodes].filter((block) =>
      block.nodeType !== Node.TEXT_NODE || block.textContent?.trim(),
    );
    const keeps = await sourceLineKeeps(blocks, checkpoint);
    for (const [index, block] of blocks.entries()) {
      const row = rows.insertRow();
      if (keeps.has(index)) row.dataset.printKeepNext = 'true';
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
      const pause = checkpoint(); if (pause) await pause;
    }
    body.replaceChildren(table);
  }
}
