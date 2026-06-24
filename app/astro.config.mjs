// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import pagefind from './src/integrations/pagefind.ts';

// https://astro.build/config
export default defineConfig({
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Linux Libertine',
      cssVariable: '--font-serif',
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/LinLibertine_Rah.ttf'],
            weight: '400',
            style: 'normal',
          },
          {
            src: ['./src/assets/fonts/LinLibertine_RIah.ttf'],
            weight: '400',
            style: 'italic',
          },
          {
            src: ['./src/assets/fonts/LinLibertine_RBah.ttf'],
            weight: '700',
            style: 'normal',
          },
          {
            src: ['./src/assets/fonts/LinLibertine_RBIah.ttf'],
            weight: '700',
            style: 'italic',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Linux Biolinum',
      cssVariable: '--font-sans',
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/LinBiolinum_Rah.ttf'],
            weight: '400',
            style: 'normal',
          },
          {
            src: ['./src/assets/fonts/LinBiolinum_RIah.ttf'],
            weight: '400',
            style: 'italic',
          },
          {
            src: ['./src/assets/fonts/LinBiolinum_RBah.ttf'],
            weight: '700',
            style: 'normal',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Playfair Display',
      cssVariable: '--font-playfair',
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/PlayfairDisplay-Regular.ttf'],
            weight: '400',
            style: 'normal',
          },
        ],
      },
    },
  ],
  devToolbar: {
    enabled: false,
  },
  output: 'static',
  integrations: [pagefind()],
  vite: {
    plugins: [tailwindcss()],
  },
});
