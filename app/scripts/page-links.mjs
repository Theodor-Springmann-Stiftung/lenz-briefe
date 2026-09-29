import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Images stay untouched so Astro can resolve and optimize the original files.
// Ordinary links to those files point to the separately published originals.
export function rewritePageLink(url, file, directory, base = '/') {
  if (/^(?:[a-z][a-z\d+.-]*:|\/|#|\?)/i.test(url)) return url;
  const resolved = new URL(url, pathToFileURL(file));
  const target = fileURLToPath(resolved);
  const relative = path.relative(directory, target).split(path.sep).join('/');
  const asset = path.relative(path.resolve(directory, '../assets'), target).split(path.sep).join('/');
  const suffix = resolved.search + resolved.hash;
  let href;
  if (asset && !path.isAbsolute(asset) && !asset.split('/').some(part => part.startsWith('.'))) {
    href = `${base}${asset.split('/').map(encodeURIComponent).join('/')}${suffix}`;
  } else if (/^[^/]+\.md$/.test(relative) && relative !== 'README.md' && !relative.startsWith('_')) {
    href = `${base}edition/${encodeURIComponent(relative.slice(0, -3))}/${suffix}`;
  } else {
    return url;
  }
  if (!statSync(target, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing linked file "${url}" in ${file}`);
  }
  return href;
}

export default function pageLinks({ directory, base = '/' }) {
  return ({ fileURL }) => {
    if (!fileURL || ![directory, path.join(directory, 'components')].includes(path.dirname(fileURLToPath(fileURL)))) return null;
    return {
      name: 'lenz:page-links',
      element: {
        filter: ['a'],
        visit(node, ctx) {
          const href = node.properties?.href;
          if (typeof href === 'string') {
            ctx.setProperty(node, 'href', rewritePageLink(href, fileURLToPath(fileURL), directory, base));
          }
        },
      },
    };
  };
}

// Astro's image collector currently visits inline images only. Expand reference
// images before that pass so both standard Markdown spellings are optimized.
export function pageImageReferences({ directory }) {
  return ({ fileURL }) => {
    if (!fileURL || ![directory, path.join(directory, 'components')].includes(path.dirname(fileURLToPath(fileURL)))) return null;
    const definitions = new Map();
    return {
      name: 'lenz:page-image-references',
      before(root) {
        for (const node of root.children) {
          if (node.type === 'definition' && !definitions.has(node.identifier)) definitions.set(node.identifier, node);
        }
      },
      imageReference(node, ctx) {
        const definition = definitions.get(node.identifier);
        if (definition) ctx.replaceNode(node, { type: 'image', url: definition.url, title: definition.title, alt: node.alt });
      },
    };
  };
}
