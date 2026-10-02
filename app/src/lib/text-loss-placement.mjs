/** Find the right edge of a margin explanation, leaving page/rotation labels intact.
 * @param {number} right
 * @param {number} top
 * @param {number} height
 * @param {{left:number, right:number, top:number, bottom:number}[]} obstacles
 * @param {number} [gap]
 */
export function textLossRightEdge(right, top, height, obstacles, gap = 12) {
  for (const obstacle of obstacles) {
    if (obstacle.bottom + gap <= top || obstacle.top - gap >= top + height) continue;
    // Only obstacles in the left margin can constrain the explanation.
    if (obstacle.left < right && obstacle.right > 0) right = Math.min(right, obstacle.left - gap);
  }
  return right;
}
