/** Reuse the build-generated link and QR so printing follows the page slug,
 * deployment base path, and configured public site URL. */
export function createPrintEditionLink(document: Document): HTMLElement {
  const template = document.querySelector<HTMLTemplateElement>('#print-edition-link-template');
  const block = template?.content.firstElementChild;
  if (!block) throw new Error('No edition page with a legend is available for printing.');
  return document.importNode(block, true) as HTMLElement;
}
