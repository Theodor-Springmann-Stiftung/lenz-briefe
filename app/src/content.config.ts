import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const pages = defineCollection({
  loader: glob({
    base: '../seiten',
    pattern: ['*.md', '!README.md', '!_*.md'],
    deferRender: true,
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    menu: z.string().trim().min(1),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    order: z.number().int().default(100),
    inMenu: z.boolean().default(true),
    legend: z.boolean().default(false),
  }),
});

export const collections = { pages };
