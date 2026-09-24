import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import watchEdition from './scripts/watch-edition.mjs';
export default defineConfig({
  site: 'https://dev.lenz-briefe.de',
  output: 'static',
  trailingSlash: 'always',
  integrations: [watchEdition()],
  vite: { plugins: [tailwindcss()] },
});
