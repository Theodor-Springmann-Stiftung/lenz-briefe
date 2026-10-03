import qrcode from 'qrcode-generator';

/** Generate during rendering, never ship the QR generator to the browser.
 * @param {string} url
 */
export function editionQr(url) {
  const code = qrcode(0, 'M');
  code.addData(url, 'Byte');
  code.make();
  // Print CSS supplies the quiet zone outside the image, so its visible edge
  // can share the URL's baseline without an offset for internal whitespace.
  const svg = code.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
