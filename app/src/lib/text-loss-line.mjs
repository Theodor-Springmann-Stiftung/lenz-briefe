/** Cut a vertical indicator around anything occupying its horizontal position.
 * @param {number} top
 * @param {number} bottom
 * @param {number} x
 * @param {{left: number, right: number, top: number, bottom: number}[]} obstacles
 * @param {number} [clearance]
 */
export function textLossSegments(top, bottom, x, obstacles, clearance = 6) {
  let segments = [{ top, bottom }];
  for (const obstacle of obstacles) {
    if (x < obstacle.left - clearance || x > obstacle.right + clearance) continue;
    const start = obstacle.top - clearance;
    const end = obstacle.bottom + clearance;
    segments = segments.flatMap((segment) => {
      if (end <= segment.top || start >= segment.bottom) return [segment];
      const remaining = [];
      if (start > segment.top) remaining.push({ top: segment.top, bottom: start });
      if (end < segment.bottom) remaining.push({ top: end, bottom: segment.bottom });
      return remaining;
    });
  }
  return segments.filter((segment) => segment.bottom > segment.top);
}
