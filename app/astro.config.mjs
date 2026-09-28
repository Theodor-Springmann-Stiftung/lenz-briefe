import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import watchEdition from './scripts/watch-edition.mjs';
import pageAssets from './scripts/page-assets.mjs';
import pageLinks, { pageImageReferences } from './scripts/page-links.mjs';
import pageLegend from './scripts/page-legend.mjs';
import { fileURLToPath } from 'node:url';
import { satteri } from '@astrojs/markdown-satteri';
const pagesDirectory = fileURLToPath(new URL('../seiten', import.meta.url));
export default defineConfig({
  site: 'https://dev.lenz-briefe.de',
  output: 'static',
  trailingSlash: 'always',
  integrations: [watchEdition(), pageAssets()],
  markdown: {
    processor: satteri({
      mdastPlugins: [pageImageReferences({ directory: pagesDirectory }), pageLegend()],
      hastPlugins: [pageLinks({ directory: pagesDirectory })],
    }),
  },
  vite: { plugins: [tailwindcss()] },
});
