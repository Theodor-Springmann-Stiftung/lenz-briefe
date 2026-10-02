# Alegreya font-system preset

> Archived preset. Source is the selected font system. These font binaries and
> their license folders were removed on 2026-10-03. To restore this preset,
> first download the files and licenses from the pinned sources below.

Saved on 2026-10-03 before the Source trial.

## Family mapping

- Alegreya: reading text, serif headings, and hand samples.
- Alegreya Sans: interface, apparatus, and Antiqua (`aq`).
- IBM Plex Mono: code examples.

| Hand | Weight | Serif width | Antiqua width | Optical settings |
| --- | --- | --- | --- | --- |
| Base | Regular, 400 | 100% | 100% | Normal |
| Second | Medium, 500 | 100% | 100% | Normal |
| Third | Bold, 700 | 100% | 100% | Normal |

Alegreya has a variable weight range of 400–900 and no width or optical-size axis.
The third hand uses Bold because the serif has no Light weight. Alegreya Sans
uses static upright and italic faces. Antiqua inherits each hand's weight in either
nesting order; its size is 1em and line-height is 1. Letter text uses 1.125rem and
line-height 1.85, subject to responsive and print rules. The first sender is the
base hand; additional hands are assigned in person-ID order. The settings also
apply to sidenotes, footer samples, and legends.

## Astro font registration

```js
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Alegreya',
      cssVariable: '--font-alegreya',
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/Alegreya.ttf'], weight: '400 900', style: 'normal' },
          { src: ['./src/assets/fonts/Alegreya-Italic.ttf'], weight: '400 900', style: 'italic' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Alegreya Sans',
      cssVariable: '--font-alegreya-sans',
      fallbacks: ['Arial', 'sans-serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/AlegreyaSans-Thin.ttf'], weight: 100, style: 'normal' },
          { src: ['./src/assets/fonts/AlegreyaSans-ThinItalic.ttf'], weight: 100, style: 'italic' },
          { src: ['./src/assets/fonts/AlegreyaSans-Light.ttf'], weight: 300, style: 'normal' },
          { src: ['./src/assets/fonts/AlegreyaSans-LightItalic.ttf'], weight: 300, style: 'italic' },
          { src: ['./src/assets/fonts/AlegreyaSans-Regular.ttf'], weight: 400, style: 'normal' },
          { src: ['./src/assets/fonts/AlegreyaSans-Italic.ttf'], weight: 400, style: 'italic' },
          { src: ['./src/assets/fonts/AlegreyaSans-Medium.ttf'], weight: 500, style: 'normal' },
          { src: ['./src/assets/fonts/AlegreyaSans-MediumItalic.ttf'], weight: 500, style: 'italic' },
          { src: ['./src/assets/fonts/AlegreyaSans-Bold.ttf'], weight: 700, style: 'normal' },
          { src: ['./src/assets/fonts/AlegreyaSans-BoldItalic.ttf'], weight: 700, style: 'italic' },
          { src: ['./src/assets/fonts/AlegreyaSans-ExtraBold.ttf'], weight: 800, style: 'normal' },
          { src: ['./src/assets/fonts/AlegreyaSans-ExtraBoldItalic.ttf'], weight: 800, style: 'italic' },
          { src: ['./src/assets/fonts/AlegreyaSans-Black.ttf'], weight: 900, style: 'normal' },
          { src: ['./src/assets/fonts/AlegreyaSans-BlackItalic.ttf'], weight: 900, style: 'italic' },
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
// Alegreya Serif supports weight 400–900, without width or optical-size axes.
// Use weights shared with Alegreya Sans: Regular, Medium, and Bold.
// Previous presets are saved in docs/*-font-settings.md.
export const handSettings = {
  base: { weight: 400, width: 100, antiquaWidth: 100, opticalSize: null },
  second: { weight: 500, width: 100, antiquaWidth: 100, opticalSize: null },
  third: { weight: 700, width: 100, antiquaWidth: 100, opticalSize: null },
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
2. Include `Font` components for `--font-alegreya`, `--font-alegreya-sans`, and
   `--font-ibm-plex-mono` in `app/src/layouts/Layout.astro`. Preload the normal
   weight-400 Serif and Sans faces only.
3. Map the global `--font-serif`, `--font-sans`, and `--font-mono` tokens to those
   variables. Keep both hand-family aliases mapped to `--font-serif`.
4. Restore the hand settings above and preserve the shared Antiqua inheritance CSS.
5. Mark Alegreya, AlegreyaSans, and IBMPlexMono as runtime fonts in the license
   index and tests; remove unused trial fonts from the license index. Update the README.
6. Build and verify the three hands, nested Antiqua, footer samples, and print styles.

## Archived download provenance

The font files and corresponding license folders are no longer in the repository.
The records below preserve their source URLs, commit IDs, and checksums. Download
both fonts and license notices again before following the restoration steps above.

### Alegreya

```json
{
  "commit": "9710da1eacb3be272583c3224dcb70f9da6eadbb",
  "sources": [
    {
      "file": "app/src/assets/fonts/Alegreya-Italic.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreya/Alegreya-Italic%5Bwght%5D.ttf",
      "sha256": "fa915eec76227935dc5fb678953c94b71287c360928013cfdb441dfe52f5a391"
    },
    {
      "file": "app/src/assets/fonts/Alegreya.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreya/Alegreya%5Bwght%5D.ttf",
      "sha256": "ba5564634b93a8f8ba57b48cd4f1ae7417d2b4656fbac779028679b00de3cf12"
    },
    {
      "file": "licenses/fonts/Alegreya/OFL.txt",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreya/OFL.txt",
      "sha256": "f6f60d5d4cf4f4b1fc4e41353c897a2f5a16e6396c0cd8fa8bdfd2f4586a9a68"
    }
  ]
}
```

### AlegreyaSans

```json
{
  "commit": "9710da1eacb3be272583c3224dcb70f9da6eadbb",
  "sources": [
    {
      "file": "app/src/assets/fonts/AlegreyaSans-Black.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-Black.ttf",
      "sha256": "95f06dd3f6e4529f176b371e89be1d5894c3ed0606c31b1d76b092a1308c1fc0"
    },
    {
      "file": "app/src/assets/fonts/AlegreyaSans-BlackItalic.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-BlackItalic.ttf",
      "sha256": "b95a8679d329ec79b5eec84e0de00f3d88ff79c4a1deaebdad77cf4ccb851282"
    },
    {
      "file": "app/src/assets/fonts/AlegreyaSans-Bold.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-Bold.ttf",
      "sha256": "a3055a1893759bdbd7504bb22abc583769e7974c49353176eac0b03792c9fb8e"
    },
    {
      "file": "app/src/assets/fonts/AlegreyaSans-BoldItalic.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-BoldItalic.ttf",
      "sha256": "6a5550f0e4c3021e7e2e83ac4814e8c649a0fe20385489ce7609f00802097b4d"
    },
    {
      "file": "app/src/assets/fonts/AlegreyaSans-ExtraBold.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-ExtraBold.ttf",
      "sha256": "3861f08a77d5c1b3b311055913443b07337a4b7abaff21a8cdb51fc0ae980b9e"
    },
    {
      "file": "app/src/assets/fonts/AlegreyaSans-ExtraBoldItalic.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-ExtraBoldItalic.ttf",
      "sha256": "3ed9e028241a8c111982006fa5e9c2ccb1f7d4683789d219cb30e8010746c37e"
    },
    {
      "file": "app/src/assets/fonts/AlegreyaSans-Italic.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-Italic.ttf",
      "sha256": "f49f6f2bdd84df850b25b0f8185d8a051e1d1eb2dd08e2f91b8c7b86d9a9e1a6"
    },
    {
      "file": "app/src/assets/fonts/AlegreyaSans-Light.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-Light.ttf",
      "sha256": "4c60a844c618502e95117426127746378bf5ac3776e04b7ab65ed3d5dc3ae081"
    },
    {
      "file": "app/src/assets/fonts/AlegreyaSans-LightItalic.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-LightItalic.ttf",
      "sha256": "4b52d6e2d85f4e6310bc50d45a6acea83077ec8cd87f63b74e853314bcaab128"
    },
    {
      "file": "app/src/assets/fonts/AlegreyaSans-Medium.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-Medium.ttf",
      "sha256": "4b89fe7804fd1485ec2757795a53ffdb66e1206dd56f844c2d72b3c944815b43"
    },
    {
      "file": "app/src/assets/fonts/AlegreyaSans-MediumItalic.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-MediumItalic.ttf",
      "sha256": "0c79da462ae637d7f95f428c935cac7a9c22cb99655c5cd37b87080861dd73ec"
    },
    {
      "file": "app/src/assets/fonts/AlegreyaSans-Regular.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-Regular.ttf",
      "sha256": "8fab634196007afca839f1e5a6fb300976daff55d8528b590ef032f01b14ea10"
    },
    {
      "file": "app/src/assets/fonts/AlegreyaSans-Thin.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-Thin.ttf",
      "sha256": "10a9d38eac06bf5d46930529b254a1bcf235c2ced7ca8fa48437fb7ddf45b674"
    },
    {
      "file": "app/src/assets/fonts/AlegreyaSans-ThinItalic.ttf",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/AlegreyaSans-ThinItalic.ttf",
      "sha256": "becc50470e3c6b29842da369485cf47523269bb2458820dc8ce7817fa4754041"
    },
    {
      "file": "licenses/fonts/AlegreyaSans/OFL.txt",
      "url": "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/alegreyasans/OFL.txt",
      "sha256": "0677891e6a143f297350d260ad766ad33bfc18ed5fa4f213acf648d6b597ec1a"
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
