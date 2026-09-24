/** Stack margin items forward, allowing notes to continue beyond their page.
 * @param {number} target
 * @param {number} height
 * @param {number} previousBottom
 * @param {number} [pageEnd]
 * @param {number} [gap]
 */
export function placeMarginItem(target, height, previousBottom, pageEnd = Infinity, gap = 18) {
  const top = Math.max(0, target, previousBottom + gap);
  const bottom = top + height;
  return {top, bottom, overflow: bottom > pageEnd};
}

/** @param {string} position */
export function sidenoteOrder(position) {
  if (position.startsWith('top')) return 0;
  if (position.startsWith('bottom')) return 2;
  return 1;
}
