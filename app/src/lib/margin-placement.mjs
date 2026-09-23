/** @param {number} start @param {number} end @param {number} height */
export function noteTarget(start, end, height) {
  return Math.max(start, end - height - 18);
}

/** Choose the closest free slot within the page; preserve oversized notes by
 * allowing overflow only when no slot in that page can contain them.
 * @param {number} target @param {number} height @param {number} start
 * @param {number} end @param {{top:number, bottom:number}[]} occupied
 * @param {boolean} [allowOverflow]
 */
export function freePosition(target, height, start, end, occupied, allowOverflow = true) {
  const blocks = [...occupied].sort((a, b) => a.top - b.top);
  const candidates = [];
  let cursor = start;
  for (const block of [...blocks, {top:Infinity, bottom:Infinity}]) {
    const limit = Math.min(end, block.top - 18) - height;
    if (cursor <= limit) candidates.push(Math.max(cursor, Math.min(target, limit)));
    cursor = Math.max(cursor, block.bottom + 18);
  }
  if (candidates.length) return candidates.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
  if (!allowOverflow) return null;
  cursor = start;
  for (const block of blocks) {
    if (cursor + height + 18 <= block.top) break;
    if (cursor < block.bottom + 18) cursor = block.bottom + 18;
  }
  return cursor;
}
/** @param {string} position */
export function sidenoteOrder(position) {
  if (position.startsWith('top')) return 0;
  if (position.startsWith('bottom')) return 2;
  return 1;
}
