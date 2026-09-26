/** Include the implicit base writer whenever tagged hands are listed.
 * @param {string[]} handRefs
 * @param {Set<string>} senderRefs
 * @param {string[]} [documentOrder]
 */
export function handKeyRefs(handRefs, senderRefs, documentOrder = []) {
  const baseRef = senderRefs.values().next().value;
  const refs = new Set([...(baseRef ? [baseRef] : []), ...handRefs]);
  return handRefs.length ? [...new Set([...documentOrder.filter(ref => refs.has(ref)), ...refs])] : [];
}

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
