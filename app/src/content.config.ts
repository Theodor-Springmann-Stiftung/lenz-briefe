import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { componentName } from '../scripts/page-components.mjs';

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
    toc: z.boolean().default(false),
  }),
});

const components = defineCollection({
  loader: glob({
    base: '../seiten/components',
    pattern: ['*.md', '!README.md', '!_*.md'],
    deferRender: true,
    generateId: ({ entry }) => componentName(entry),
  }),
  schema: z.object({
    prose: z.boolean().default(true),
    class: z.string().optional(),
  }),
});

export const collections = { pages, components };
