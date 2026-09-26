/**
 * Prefer a complete matching pair over closer but unrelated examples.
 * @template {{kind: string, pairKey?: string, score: number}} T
 * @param {T[]} candidates
 * @param {string[] | null} kinds
 * @returns {T[]}
 */
export function selectLegendTargets(candidates, kinds = null) {
  const sorted = [...candidates].sort((a, b) => a.score - b.score);
  if (!kinds) return sorted.slice(0, 1);
  const pairs = sorted.filter(candidate => candidate.kind === kinds[0] && candidate.pairKey)
    .flatMap(first => {
      const second = sorted.find(candidate => candidate.kind === kinds[1] && candidate.pairKey === first.pairKey);
      return second ? [[first, second]] : [];
    }).sort((a, b) => a[0].score + a[1].score - b[0].score - b[1].score);
  return pairs[0] || sorted.slice(0, 1);
}
