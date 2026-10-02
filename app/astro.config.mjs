import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import watchEdition from './scripts/watch-edition.mjs';
import pageLinks, { pageImageReferences } from './scripts/page-links.mjs';
import pageComponents from './scripts/page-components.mjs';
import offlineEdition from './scripts/offline-build.mjs';
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
      name: 'Source Serif 4',
      cssVariable: '--font-source-serif',
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/SourceSerif4.ttf'], weight: '200 900', style: 'normal' },
          { src: ['./src/assets/fonts/SourceSerif4-Italic.ttf'], weight: '200 900', style: 'italic' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Source Sans 3',
      cssVariable: '--font-source-sans',
      fallbacks: ['Arial', 'sans-serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/SourceSans3.ttf'], weight: '200 900', style: 'normal' },
          { src: ['./src/assets/fonts/SourceSans3-Italic.ttf'], weight: '200 900', style: 'italic' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Source Code Pro',
      cssVariable: '--font-source-code',
      fallbacks: ['monospace'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/SourceCodePro.ttf'], weight: '200 900', style: 'normal' },
          { src: ['./src/assets/fonts/SourceCodePro-Italic.ttf'], weight: '200 900', style: 'italic' },
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
    offlineEdition(),
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
