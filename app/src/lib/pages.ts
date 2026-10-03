import { getCollection, render } from 'astro:content';

export const pageUrl = (slug: string) =>
  `${import.meta.env.BASE_URL}edition/${encodeURIComponent(slug)}/`;

export async function editionPages() {
  return (await getCollection('pages')).sort(
    (a, b) =>
      a.data.order - b.data.order ||
      a.data.menu.localeCompare(b.data.menu, 'de') ||
      a.id.localeCompare(b.id, 'de'),
  );
}

export async function editionLegendPage() {
  for (const page of await editionPages()) {
    if (page.data.legend || (await render(page)).remarkPluginFrontmatter.hasLegend) return page;
  }
}
