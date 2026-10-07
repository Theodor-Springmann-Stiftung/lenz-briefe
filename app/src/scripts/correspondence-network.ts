import { correspondenceStar } from '../lib/correspondence-network.mjs';

const namespace = 'http://www.w3.org/2000/svg';
function svgElement(tag: string, attributes: Record<string, string | number>) {
  const element = document.createElementNS(namespace, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

export function setupCorrespondenceNetwork() {
  const svg = document.querySelector<SVGSVGElement>('.correspondence-network');
  const shell = document.querySelector<HTMLElement>('.site-shell');
  const intro = document.querySelector<HTMLElement>('.index-intro');
  const dataElement = document.querySelector('#correspondence-network-data');
  if (!svg || !shell || !intro || !dataElement) return;
  const data = JSON.parse(dataElement.textContent!);
  const rows = [...document.querySelectorAll<HTMLElement>('.catalog-letter-list > [data-letter]')];
  const edgesLayer = svg.querySelector('.correspondence-network-edges')!;
  const nodesLayer = svg.querySelector('.correspondence-network-nodes')!;
  const desktop = matchMedia('(min-width: 1440px)');
  let frame = 0;

  function draw() {
    frame = 0;
    if (!desktop.matches) return;
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    const bounds = intro!.getBoundingClientRect();
    const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 60;
    const top = Math.max(headerBottom + 64, 130);
    const bottom = Math.max(top + 100, height - 80);
    const gutter = Math.max(0, bounds.left - 28);
    const graph = correspondenceStar(data.letters,
      new Set(rows.filter(row => !row.hidden).map(row => row.dataset.letter)), data.people, data.hubId);
    svg!.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Alternate partners between the margins; place the busiest partners first.
    const hub = graph.nodes.find(node => node.id === data.hubId);
    const hubPosition = { x: width / 2, y: headerBottom + 40 };
    const nodes = graph.nodes.filter(node => node.id !== data.hubId)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de'));
    const positions = new Map<string, { x: number; y: number }>();
    const sideCount = Math.ceil(nodes.length / 2);
    const columns = Math.max(1, Math.ceil(sideCount / Math.max(1, Math.floor((bottom - top) / 44))));
    const rowCount = Math.ceil(sideCount / columns);
    const nodeFragment = document.createDocumentFragment();
    nodes.forEach((node, index) => {
      const side = index % 2;
      const slot = Math.floor(index / 2);
      const column = Math.floor(slot / rowCount);
      const row = slot % rowCount;
      const phase = (Number(node.id) || index) * 2.39996;
      const vertical = (row + .5) / Math.max(1, rowCount);
      // Bow the partner points around the central column instead of a rectangular grid.
      const distance = gutter * (.72 - .3 * Math.sin(vertical * Math.PI)
        + .12 * column / columns) + Math.sin(phase) * 8;
      const x = side === 0 ? distance : width - distance;
      const y = top + (row + .5) * (bottom - top) / Math.max(1, rowCount) + Math.cos(phase) * 9;
      positions.set(node.id, { x, y });
      const group = svgElement('g', { 'data-network-person': node.id });
      const radius = Math.min(6, 2.5 + Math.sqrt(node.count) * .5);
      group.append(svgElement('circle', { cx: x, cy: y, r: radius + 5, class: 'network-node-halo' }));
      group.append(svgElement('circle', { cx: x, cy: y, r: radius, class: 'network-node-point' }));
      // At high density, retain every point but label only the strongest partners.
      if (columns === 1 || index < 12) {
        const label = svgElement('text', {
          x, y: y + radius + 20,
          'text-anchor': 'middle',
        });
        label.textContent = node.name;
        // Fit long names to the margin without crossing into the reading area.
        group.append(label);
      }
      nodeFragment.append(group);
    });
    nodesLayer.replaceChildren(nodeFragment);
    nodesLayer.querySelectorAll('text').forEach(label => {
      const available = Math.max(1, gutter - 40);
      const length = Math.min(label.getComputedTextLength(), available);
      if (label.getComputedTextLength() > available) {
        label.setAttribute('textLength', String(available));
        label.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      }
      const side = Number(label.getAttribute('x')) < width / 2 ? 0 : 1;
      const x = Number(label.getAttribute('x'));
      label.setAttribute('x', String(side === 0
        ? Math.max(20 + length / 2, Math.min(gutter - length / 2, x))
        : Math.max(width - gutter + length / 2, Math.min(width - 20 - length / 2, x))));
    });
    if (hub) {
      const group = svgElement('g', { 'data-network-person': hub.id, class: 'network-hub' });
      group.append(svgElement('circle', { cx: hubPosition.x, cy: hubPosition.y, r: 13, class: 'network-node-halo' }));
      group.append(svgElement('circle', { cx: hubPosition.x, cy: hubPosition.y, r: 6, class: 'network-node-point' }));
      const label = svgElement('text', { x: hubPosition.x, y: hubPosition.y + 29, 'text-anchor': 'middle', class: 'network-hub-label' });
      label.textContent = hub.name;
      group.append(label);
      nodesLayer.append(group);
    }
    const edgeFragment = document.createDocumentFragment();
    for (const edge of graph.edges) {
      const source = hubPosition;
      const target = positions.get(edge.target)!;
      edgeFragment.append(svgElement('path', {
        d: `M ${source.x} ${source.y} L ${target.x} ${target.y}`,
        'stroke-width': Math.min(2, .6 + Math.log1p(edge.count) * .22),
      }));
    }
    edgesLayer.replaceChildren(edgeFragment);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(draw);
  }
  document.addEventListener('catalog:change', schedule);
  window.addEventListener('resize', schedule);
  desktop.addEventListener('change', schedule);
  new ResizeObserver(schedule).observe(shell);
  void document.fonts.ready.then(schedule);
  schedule();
}
