/** Keep source order and show each writer once in a shared line label.
 * @param {string[]} names
 */
export function handLabelNames(names) {
  const unique = [...new Set(names)];
  return unique.length > 1 ? unique.map((name) => name.trim().split(/\s+/).at(-1) ?? name) : unique;
}

/** Group measured anchors on the same line, allowing for different hand fonts.
 * Retain source order within each group even when glyph tops differ slightly.
 * @template {{ target: number }} T
 * @param {T[]} entries
 * @param {number} tolerance
 * @returns {T[][]}
 */
export function groupHandLabelLines(entries, tolerance = 4) {
  const groups = [];
  for (const entry of [...entries].sort((a, b) => a.target - b.target)) {
    const previous = groups.at(-1);
    if (previous && entry.target - previous[0].target <= tolerance) previous.push(entry);
    else groups.push([entry]);
  }
  return groups.map((group) => group.sort((a, b) => entries.indexOf(a) - entries.indexOf(b)));
}

/** Include continuing writers on a labelled line, in transcription order.
 * @param {{ target: number, ref: string }[]} anchors
 * @param {{ tops: number[], ref: string }[]} texts
 * @param {number} tolerance
 */
export function handRefsOnLine(anchors, texts, tolerance = 4) {
  return [...new Set([
    ...texts.filter(({ tops }) => tops.some((top) => anchors.some(({ target }) => Math.abs(top - target) <= tolerance)))
      .map(({ ref }) => ref),
    ...anchors.map(({ ref }) => ref),
  ])];
}
