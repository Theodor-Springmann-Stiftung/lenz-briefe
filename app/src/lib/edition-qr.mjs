import qrcode from 'qrcode-generator';

/** Generate during rendering, never ship the QR generator to the browser.
 * @param {string} url
 */
export function editionQr(url) {
  const code = qrcode(0, 'M');
  code.addData(url, 'Byte');
  code.make();
  const svg = code.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
