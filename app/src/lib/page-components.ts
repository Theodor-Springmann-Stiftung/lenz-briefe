import { indexComponentFiles } from '../../scripts/page-components.mjs';

// Vite watches additions, removals and edits for both formats. Only HTML sources
// are loaded as strings; Markdown rendering stays in Astro's content collection.
export const componentFiles = indexComponentFiles(
  import.meta.glob<string>(
    [
      '../../../seiten/components/*.{md,html}',
      '!../../../seiten/components/README.*',
      '!../../../seiten/components/_*',
    ],
    { query: '?raw', import: 'default' },
  ),
);
