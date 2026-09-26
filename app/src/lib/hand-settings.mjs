// Tune all letter text, footer samples, and both legends here.
// Weight: 200–900. Optical size: 8–60, or null for automatic sizing.
export const handSettings = {
  base:   { weight: 400, opticalSize: null },
  second: { weight: 530, opticalSize: 45 },
  third:  { weight: 380, opticalSize: 10 },
};

/** @param {keyof typeof handSettings} hand */
export function handDeclarations(hand) {
  return `font-weight:var(--hand-${hand}-weight); font-variation-settings:var(--hand-${hand}-optical);`;
}

export function handSettingsVariables() {
  return Object.entries(handSettings).map(([hand, {weight, opticalSize}]) =>
    `--hand-${hand}-weight:${weight}; --hand-${hand}-optical:${opticalSize === null ? 'normal' : `"opsz" ${opticalSize}`};`
  ).join('\n');
}
