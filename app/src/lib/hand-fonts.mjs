/** Assign distinct typefaces to the tagged writers in one letter.
 * @param {string[]} handRefs
 * @param {Set<string>} senderRefs
 * @returns {Map<string, string>}
 */
export function handFonts(handRefs, senderRefs) {
  const baseRef = senderRefs.values().next().value;
  const alternatives = ['var(--font-hand)', 'var(--font-hand-second)'];
  let next = 0;
  return new Map([...new Set(handRefs)].sort((a, b) => Number(a) - Number(b)).map(ref => {
    if (ref === baseRef) return [ref, 'var(--font-serif)'];
    const font = alternatives[next++];
    if (!font) throw new Error('This letter needs another distinct handwriting font.');
    return [ref, font];
  }));
}
