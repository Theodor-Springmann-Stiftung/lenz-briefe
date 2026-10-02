# Roboto font-system preset

> Archived preset. Source is the selected font system. These font binaries and
> their license folders were removed on 2026-10-03. To restore this preset,
> first download the files and licenses from the pinned sources below.

Saved on 2026-10-03 before the IBM Plex trial.

## Family mapping

- Main text, headings, and hand samples: **Roboto Serif**.
- Interface, editorial apparatus, and Antiqua (`aq`): **Roboto Flex** (sans-serif).
- First sender is the base hand; other writers receive second and third styles in person-ID order.
- Hand mapping applies to letter text, sidenotes, footer samples, and both legends.

## Final hand settings

| Hand | Serif width | Antiqua width | Weight | Optical size |
| --- | --- | --- | --- | --- |
| Base | 92% | 100% | 400 | Automatic |
| Second | 75% (Condensed) | 75% | 400 | Automatic |
| Third | 50% (Ultra-Condensed) | 50% | 400 | Automatic |

The base serif was narrowed from 100% to 95%, then to **92%**. This adjustment
applies to the edition's base hand, not every serif heading. Antiqua remains 100%.
Widths use the real variable-font axis through CSS `font-stretch`, not transforms.
Antiqua preserves the current hand in either nesting order. It uses `font-size:1em`
and `line-height:1`; the containing line supplies the leading. Letter text uses
1.125rem with a line-height of 1.85, subject to existing responsive and print rules.
Bold and italic markup remains available independently of hand width.

## Font registration

The fonts are local, served by Astro's Fonts API. Roboto Serif includes separate
upright and italic variable fonts. Roboto Flex uses the same variable file for both
styles; its italic face sets `"slnt" -10`. Regular serif and sans faces are preloaded.

```js
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Roboto Serif',
      cssVariable: '--font-roboto-serif',
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/RobotoSerif.ttf'], weight: '100 900', stretch: '50% 150%', style: 'normal' },
          { src: ['./src/assets/fonts/RobotoSerif-Italic.ttf'], weight: '100 900', stretch: '50% 150%', style: 'italic' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Roboto Flex',
      cssVariable: '--font-roboto-flex',
      fallbacks: ['Arial', 'sans-serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/RobotoFlex.ttf'], weight: '100 1000', stretch: '25% 151%', style: 'normal' },
          { src: ['./src/assets/fonts/RobotoFlex.ttf'], weight: '100 1000', stretch: '25% 151%', style: 'italic', variationSettings: '"slnt" -10' },
        ],
      },
    },
  ],
```

## Settings module

Saved contents of `app/src/lib/hand-settings.mjs`:

```js
// Tune all letter text, footer samples, and both legends here.
// Shared Roboto axes: weight 100–900, width 50–150, optical size 8–144.
// null optical size lets the font adapt automatically to the rendered size.
export const handSettings = {
  base: { weight: 400, width: 92, antiquaWidth: 100, opticalSize: null },
  second: { weight: 400, width: 75, antiquaWidth: 75, opticalSize: null },
  third: { weight: 400, width: 50, antiquaWidth: 50, opticalSize: null },
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
```

## Restoring this preset

1. Restore the font registration above in `app/astro.config.mjs`.
2. In `app/src/layouts/Layout.astro`, render `Font` for `--font-roboto-serif` and
   `--font-roboto-flex`, preloading weight 400, normal style.
3. In `app/src/styles/global.css`, map `--font-serif` to `--font-roboto-serif` and
   `--font-sans` to `--font-roboto-flex`. Both hand-family aliases use `--font-serif`.
   Remove the Plex Mono `Font` entry and `--font-mono` override to restore the
   former system monospace stack.
4. Restore the settings module above. Keep the shared hand-width and Antiqua CSS,
   including the `--hand-aq-width` inheritance and the base-width override in `.aq`.
5. Mark RobotoSerif and RobotoFlex as active fonts in `licenses/README.md` and update
   the runtime-font expectations in `app/tests/licenses.test.mjs`. Remove unused font entries from the license index.
6. Build and check base/second/third hand samples and nested Antiqua on screen and
   in print. Font identity in the legend includes `fontStretch`.

## Archived download provenance

The font files and corresponding license folders are no longer in the repository.
The records below preserve their source URLs, commit IDs, and checksums. Download
both fonts and license notices again before following the restoration steps above.

### RobotoSerif

```json
{
  "commit": "9710da1eacb3be272583c3224dcb70f9da6eadbb",
  "sources": [
    {
      "file": "licenses/fonts/RobotoSerif/OFL.txt",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/robotoserif/OFL.txt",
      "sha256": "34dbfbb43e0b4fdeef445d77b9ac0b988e5ad7a9bbf16808c97b66c66d51f553"
    },
    {
      "file": "app/src/assets/fonts/RobotoSerif-Italic.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/robotoserif/RobotoSerif-Italic%5BGRAD%2Copsz%2Cwdth%2Cwght%5D.ttf",
      "sha256": "695ffbe6bfd0893a8de90b1ea13632e7e838bc7427b818584e1daf82b36b99de"
    },
    {
      "file": "app/src/assets/fonts/RobotoSerif.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/robotoserif/RobotoSerif%5BGRAD%2Copsz%2Cwdth%2Cwght%5D.ttf",
      "sha256": "351ced75f3851806aa6d846b669361521eb1925cfc530396df9c1a1b77061ddb"
    }
  ]
}
```

### RobotoFlex

```json
{
  "commit": "9710da1eacb3be272583c3224dcb70f9da6eadbb",
  "sources": [
    {
      "file": "licenses/fonts/RobotoFlex/OFL.txt",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/robotoflex/OFL.txt",
      "sha256": "9cbaed04b20c853f99840efe5dc96956f6f6120ed83a0ade35f9281a2b63e5d0"
    },
    {
      "file": "app/src/assets/fonts/RobotoFlex.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/robotoflex/RobotoFlex%5BGRAD%2CXOPQ%2CXTRA%2CYOPQ%2CYTAS%2CYTDE%2CYTFI%2CYTLC%2CYTUC%2Copsz%2Cslnt%2Cwdth%2Cwght%5D.ttf",
      "sha256": "9b523f7d82593df0107173849ebb8c817471a1df4b4fb2c3cbf40cfd810c8281"
    }
  ]
}
```
