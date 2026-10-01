const failedImages = new Set();

/** The browser reports HTTP errors, blocked requests and invalid images alike. */
export function bindFilterCardImages(root, failed = failedImages) {
  root.querySelectorAll('[data-gnd-picture] img').forEach((image) => {
    const column = image.closest('[data-gnd-picture]');
    const hide = () => {
      column.hidden = true;
      failed.add(image.src);
    };
    image.addEventListener('error', hide, { once: true });
    image.addEventListener('load', () => {
      if (!image.naturalWidth) hide();
    }, { once: true });
    // Account for an already failed cached image without hiding an unstarted lazy load.
    if (failed.has(image.src) || (image.complete && image.currentSrc && !image.naturalWidth)) hide();
  });
}
