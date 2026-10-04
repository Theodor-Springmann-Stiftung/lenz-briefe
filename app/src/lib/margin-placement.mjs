/** Find the first gap that fits a complete note without moving reserved items.
 * @param {number} target
 * @param {number} height
 * @param {{top: number, bottom: number, gap: number}[]} occupied
 * @param {number} [pageEnd]
 * @param {number} [gap]
 */
export function placeMarginItem(target, height, occupied, pageEnd = Infinity, gap = 6) {
  let top = Math.max(0, target);
  for (const slot of [...occupied].sort((a, b) => a.top - b.top)) {
    const clearance = Math.max(gap, slot.gap);
    if (top + height + clearance <= slot.top) break;
    if (top < slot.bottom + clearance) top = slot.bottom + clearance;
  }
  const bottom = top + height;
  return { top, bottom, overflow: bottom > pageEnd };
}

/** Pack overlapping items outward from the text; leave unrelated rows alone. */
export function leftMarginOffset(top, height, occupied, gap = 12) {
  return Math.max(0, ...occupied
    .filter(slot => top < slot.bottom + 6 && top + height > slot.top - 6)
    .map(slot => slot.offset + slot.width + gap));
}

/** @param {string} position */
export function sidenoteOrder(position) {
  if (position.startsWith('top')) return 0;
  if (position.startsWith('bottom')) return 2;
  return 1;
}
