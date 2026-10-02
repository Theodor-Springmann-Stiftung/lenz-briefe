// Tune all letter text, footer samples, and both legends here.
// Source families support weights 200–900. Source Serif optical size: 8–60.
// Keep Regular/Medium/Light hands at natural width; null enables automatic optical sizing.
// Previous presets are saved in docs/*-font-settings.md.
export const handSettings = {
  base: { weight: 400, width: 100, antiquaWidth: 100, opticalSize: null },
  second: { weight: 500, width: 100, antiquaWidth: 100, opticalSize: null },
  third: { weight: 300, width: 100, antiquaWidth: 100, opticalSize: null },
};

/** @param {keyof typeof handSettings} hand */
export function handDeclarations(hand) {
  return `--hand-aq-width:var(--hand-${hand}-aq-width); font-stretch:var(--hand-${hand}-width); font-weight:var(--hand-${hand}-weight); font-variation-settings:var(--hand-${hand}-optical);`;
}

export function handSettingsVariables() {
  return Object.entries(handSettings)
    .map(
      ([hand, { weight, width, antiquaWidth, opticalSize }]) =>
        `--hand-${hand}-aq-width:${antiquaWidth}%; --hand-${hand}-width:${width}%; --hand-${hand}-weight:${weight}; --hand-${hand}-optical:${opticalSize === null ? 'normal' : `"opsz" ${opticalSize}`};`,
    )
    .join('\n');
}
