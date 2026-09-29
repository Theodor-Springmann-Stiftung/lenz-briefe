import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import watchEdition from './scripts/watch-edition.mjs';
import pageLinks, { pageImageReferences } from './scripts/page-links.mjs';
import pageComponents from './scripts/page-components.mjs';
import { fileURLToPath } from 'node:url';
import { cp } from 'node:fs/promises';
import { satteri } from '@astrojs/markdown-satteri';
const pagesDirectory = fileURLToPath(new URL('../seiten', import.meta.url));
export default defineConfig({
  site: 'https://dev.lenz-briefe.de',
  output: 'static',
  publicDir: '../assets',
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Linux Biolinum',
      cssVariable: '--font-linux-biolinum',
      fallbacks: ['Arial', 'sans-serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/LinBiolinum_R.otf'], weight: 400, style: 'normal' },
          { src: ['./src/assets/fonts/LinBiolinum_RI.otf'], weight: 400, style: 'italic' },
          { src: ['./src/assets/fonts/LinBiolinum_RB.otf'], weight: 700, style: 'normal' },
          { src: ['./src/assets/fonts/LinBiolinum_RBO.otf'], weight: 700, style: 'italic' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Source Serif',
      cssVariable: '--font-source-serif',
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/SourceSerif4.ttf'], weight: '200 900', style: 'normal' },
          {
            src: ['./src/assets/fonts/SourceSerif4-Italic.ttf'],
            weight: '200 900',
            style: 'italic',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Roboto Slab',
      cssVariable: '--font-roboto-slab',
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/RobotoSlab.ttf'], weight: '100 900', style: 'normal' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Cormorant Garamond',
      cssVariable: '--font-cormorant-garamond',
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/CormorantGaramond.ttf'], weight: '300 700', style: 'normal' },
          {
            src: ['./src/assets/fonts/CormorantGaramond-Italic.ttf'],
            weight: '300 700',
            style: 'italic',
          },
        ],
      },
    },
  ],
  trailingSlash: 'always',
  integrations: [
    watchEdition(),
    {
      name: 'lenz:licenses',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          await cp(new URL('../licenses/', import.meta.url), new URL('licenses/', dir), {
            recursive: true,
          });
        },
      },
    },
  ],
  markdown: {
    processor: satteri({
      mdastPlugins: [
        pageImageReferences({ directory: pagesDirectory }),
        pageComponents({ directory: pagesDirectory }),
      ],
      hastPlugins: [pageLinks({ directory: pagesDirectory })],
    }),
  },
  vite: { plugins: [tailwindcss()] },
});
