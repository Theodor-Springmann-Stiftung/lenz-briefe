# IBM Plex font-system preset

> Archived preset. Source is the selected font system. These font binaries and
> their license folders were removed on 2026-10-03. To restore this preset,
> first download the files and licenses from the pinned sources below.

Saved on 2026-10-03 before the Alegreya trial.

## Mapping and hand settings

- IBM Plex Serif: reading text, serif headings, hand samples.
- IBM Plex Sans: interface, apparatus, Antiqua (`aq`).
- IBM Plex Mono: code examples.

| Hand | Weight | Serif width | Antiqua width | Optical settings |
| --- | --- | --- | --- | --- |
| Base | Regular, 400 | 100% | 100% | Normal |
| Second | Medium, 500 | 100% | 100% | Normal |
| Third | Light, 300 | 100% | 100% | Normal |

The first sender is the base hand. Other writers receive second and third styles
in person-ID order. The mapping includes sidenotes, footer samples, and legends.
Antiqua inherits the hand weight in either nesting order. Explicit bold and italic
markup remains available. Antiqua is 1em with line-height 1; the containing line
supplies the leading. Reading text uses 1.125rem and line-height 1.85, subject to
existing responsive and print rules.

All fonts include separate upright and true italic variable files, with weight
ranges 100–700. Serif and Mono have no width or optical-size axes. Sans supports
widths 85–100%, but this trial uses its natural 100% width throughout.

## Astro font registration

```js
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'IBM Plex Serif',
      cssVariable: '--font-ibm-plex-serif',
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/IBMPlexSerif.ttf'], weight: '100 700', style: 'normal' },
          { src: ['./src/assets/fonts/IBMPlexSerif-Italic.ttf'], weight: '100 700', style: 'italic' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'IBM Plex Sans',
      cssVariable: '--font-ibm-plex-sans',
      fallbacks: ['Arial', 'sans-serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/IBMPlexSans.ttf'], weight: '100 700', stretch: '85% 100%', style: 'normal' },
          { src: ['./src/assets/fonts/IBMPlexSans-Italic.ttf'], weight: '100 700', stretch: '85% 100%', style: 'italic' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'IBM Plex Mono',
      cssVariable: '--font-ibm-plex-mono',
      fallbacks: ['monospace'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/IBMPlexMono.ttf'], weight: '100 700', style: 'normal' },
          { src: ['./src/assets/fonts/IBMPlexMono-Italic.ttf'], weight: '100 700', style: 'italic' },
        ],
      },
    },
  ],
```

## Hand settings module

Saved `app/src/lib/hand-settings.mjs`:

```js
// Tune all letter text, footer samples, and both legends here.
// IBM Plex trial: Serif has a weight axis (100–700), but no width or optical axis.
// Distinguish hands by weight; keep both Serif and Sans at their natural width.
// The preceding Roboto preset is saved in docs/roboto-font-settings.md.
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
```

## Restoration

1. Restore the font registration above in `app/astro.config.mjs`.
2. In `app/src/layouts/Layout.astro`, include `Font` for `--font-ibm-plex-serif`,
   `--font-ibm-plex-sans`, and `--font-ibm-plex-mono`. Preload normal weight 400 for
   Serif and Sans; do not preload Mono.
3. Map the global `--font-serif`, `--font-sans`, and `--font-mono` theme tokens to
   those variables. Both hand-family aliases remain mapped to `--font-serif`.
4. Restore the hand settings above, retaining the shared Antiqua inheritance CSS.
5. Mark IBMPlexSerif, IBMPlexSans, and IBMPlexMono as runtime fonts in the license
   index and tests. Remove unused trial fonts from the license index.
6. Update `app/README.md`, build, and check all three hands, nested Antiqua,
   footer samples, and screen/print rendering.

## Archived download provenance

The font files and corresponding license folders are no longer in the repository.
The records below preserve their source URLs, commit IDs, and checksums. Download
both fonts and license notices again before following the restoration steps above.

### IBMPlexSerif

```json
{
  "commit": "763c36ef9117782905ae010056dfbe8fd2653a25",
  "sources": [
    {
      "file": "app/src/assets/fonts/IBMPlexSerif.ttf",
      "url": "https://raw.githubusercontent.com/IBM/plex/763c36ef9117782905ae010056dfbe8fd2653a25/packages/plex-serif-variable/fonts/complete/ttf/IBM%20Plex%20Serif%20Var-Roman.ttf",
      "sha256": "9ad35cae7ba68f7c146e100094feee2a9a7136a5be7e69fe8fc55053650b79c1"
    },
    {
      "file": "app/src/assets/fonts/IBMPlexSerif-Italic.ttf",
      "url": "https://raw.githubusercontent.com/IBM/plex/763c36ef9117782905ae010056dfbe8fd2653a25/packages/plex-serif-variable/fonts/complete/ttf/IBM%20Plex%20Serif%20Var-Italic.ttf",
      "sha256": "d7a5505e9827f4a66d74f872045a21626ac948febcb16d8d7d67d825e3eb0b4a"
    },
    {
      "file": "licenses/fonts/IBMPlexSerif/OFL.txt",
      "url": "https://raw.githubusercontent.com/IBM/plex/763c36ef9117782905ae010056dfbe8fd2653a25/packages/plex-serif-variable/LICENSE.txt",
      "sha256": "7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da"
    }
  ]
}
```

### IBMPlexSans

```json
{
  "commit": "763c36ef9117782905ae010056dfbe8fd2653a25",
  "sources": [
    {
      "file": "app/src/assets/fonts/IBMPlexSans.ttf",
      "url": "https://raw.githubusercontent.com/IBM/plex/763c36ef9117782905ae010056dfbe8fd2653a25/packages/plex-sans-variable/fonts/complete/ttf/IBM%20Plex%20Sans%20Var-Roman.ttf",
      "sha256": "3ed3ea3b1b3854afdf3306e9ab60773ec03cd7466bf0017131c166d943408713"
    },
    {
      "file": "app/src/assets/fonts/IBMPlexSans-Italic.ttf",
      "url": "https://raw.githubusercontent.com/IBM/plex/763c36ef9117782905ae010056dfbe8fd2653a25/packages/plex-sans-variable/fonts/complete/ttf/IBM%20Plex%20Sans%20Var-Italic.ttf",
      "sha256": "ad691c8be9352a5c024e3d158856b3a073841280347c25bfba2ce75cc349b7ad"
    },
    {
      "file": "licenses/fonts/IBMPlexSans/OFL.txt",
      "url": "https://raw.githubusercontent.com/IBM/plex/763c36ef9117782905ae010056dfbe8fd2653a25/packages/plex-sans-variable/LICENSE.txt",
      "sha256": "7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da"
    }
  ]
}
```

### IBMPlexMono

```json
{
  "commit": "763c36ef9117782905ae010056dfbe8fd2653a25",
  "sources": [
    {
      "file": "app/src/assets/fonts/IBMPlexMono.ttf",
      "url": "https://raw.githubusercontent.com/IBM/plex/763c36ef9117782905ae010056dfbe8fd2653a25/packages/plex-mono-variable/fonts/complete/ttf/IBM%20Plex%20Mono%20Var-Roman.ttf",
      "sha256": "7e514ee3a359d82b2f572751dc2184f380a72160299c040b4c978a7093013743"
    },
    {
      "file": "app/src/assets/fonts/IBMPlexMono-Italic.ttf",
      "url": "https://raw.githubusercontent.com/IBM/plex/763c36ef9117782905ae010056dfbe8fd2653a25/packages/plex-mono-variable/fonts/complete/ttf/IBM%20Plex%20Mono%20Var-Italic.ttf",
      "sha256": "6242bbf32814be87c33a7f2eeaed2bdc90ea0088dac25be712ba7fe8981bd6d4"
    },
    {
      "file": "licenses/fonts/IBMPlexMono/OFL.txt",
      "url": "https://raw.githubusercontent.com/IBM/plex/763c36ef9117782905ae010056dfbe8fd2653a25/packages/plex-mono-variable/LICENSE.txt",
      "sha256": "7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da"
    }
  ]
}
```
