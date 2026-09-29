import { registerLayoutTask } from './reading-layout';

type HandFragment = HTMLElement | Range;
interface HandRange {
  trigger: HTMLElement;
  groups: HandFragment[][];
}

/** Measure implicit handwriting without inserting wrappers or changing layout. */
export function implicitHandGroups(container: HTMLElement): Range[][] {
  const groups: Range[][] = [];
  let current: Range[] = [];
  const flush = () => {
    if (current.length) groups.push(current);
    current = [];
  };
  function visit(node: Node) {
    if (
      node instanceof Element &&
      node.matches('.hand, .note, .pe, .hand-range-background, .inpos-note')
    ) {
      flush();
      return;
    }
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      current.push(range);
    }
    node.childNodes.forEach(visit);
  }
  visit(container);
  flush();
  return groups;
}

/** XSLT reopens one source hand across lines; data-origin reunites those spans. */
export function handGroups(container: HTMLElement) {
  const groups = new Map<string, HTMLElement[]>();
  container.querySelectorAll<HTMLElement>('.hand').forEach((hand, index) => {
    if (hand.closest('.inpos-note') && !container.closest('.inpos-note')) return;
    const origin = hand.dataset.origin || `hand-${index}`;
    groups.set(origin, [...(groups.get(origin) || []), hand]);
  });
  return [...groups.values()];
}

export function createHandRangeHighlighter() {
  const backgrounds: HTMLElement[] = [];
  let hovered: HandRange | null = null;
  let focused: HandRange | null = null;
  let highlighted: HandRange | null = null;

  function positionBackground() {
    const placements: {
      container: HTMLElement;
      left: number;
      top: number;
      width: number;
      height: number;
    }[] = [];
    const origins = new Map<HTMLElement, { left: number; top: number }>();
    function paint(
      container: HTMLElement,
      left: number,
      top: number,
      width: number,
      height: number,
    ) {
      let origin = origins.get(container);
      if (!origin) {
        const bounds = container.getBoundingClientRect();
        origin = {
          left: bounds.left - container.scrollLeft + container.clientLeft,
          top: bounds.top - container.scrollTop + container.clientTop,
        };
        origins.set(container, origin);
      }
      placements.push({
        container,
        left: left - origin.left,
        top: top - origin.top,
        width,
        height,
      });
    }
    highlighted?.groups.forEach((group) => {
      // A source hand can continue into another table cell. Each cell owns its highlight.
      const scopes = new Map<HTMLElement, HandFragment[]>();
      for (const fragment of group) {
        const element =
          fragment instanceof Range ? fragment.startContainer.parentElement : fragment;
        const scope = element?.closest<HTMLElement>('.tab, .edition-text');
        if (scope) scopes.set(scope, [...(scopes.get(scope) || []), fragment]);
      }
      scopes.forEach((fragments, scope) => {
        const rects = fragments
          .flatMap((fragment) => [...fragment.getClientRects()])
          .filter((rect) => rect.width > 0 && rect.height > 0);
        const first = fragments[0];
        const element = first instanceof Range ? first.startContainer.parentElement : first;
        const container = element?.closest<HTMLElement>('.edition-text');
        if (!rects.length || !container) return;
        const owns = (node: Node) =>
          fragments.some((fragment) =>
            fragment instanceof Range ? fragment.intersectsNode(node) : fragment.contains(node),
          );
        const blocks = new Set(
          fragments.map((fragment) => {
            const element =
              fragment instanceof Range ? fragment.startContainer.parentElement : fragment;
            return element?.closest<HTMLElement>('.lb-line-block, .lb-tab-prefix, .tab') || scope;
          }),
        );
        const wholePassage = [...blocks].every((block) => {
          const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
          let node: Node | null;
          while ((node = walker.nextNode())) {
            if (node.textContent?.trim() && !owns(node)) return false;
          }
          return true;
        });
        if (wholePassage) {
          const bounds = scope.getBoundingClientRect();
          const top = Math.min(...rects.map((rect) => rect.top));
          const bottom = Math.max(...rects.map((rect) => rect.bottom));
          const padding = scope.matches('.tab') ? 0 : 6;
          paint(
            container,
            bounds.left - padding,
            top - 4,
            scope.clientWidth + padding * 2,
            bottom - top + 8,
          );
        } else {
          // Merge overlapping fragments on the same visual line, keeping wrapped
          // inline changes tight to their words rather than filling the column.
          const lines: { left: number; right: number; top: number; bottom: number }[] = [];
          for (const rect of rects.sort((a, b) => a.top - b.top || a.left - b.left)) {
            const line = lines.find(
              (line) =>
                Math.abs(line.top - rect.top) < 2 &&
                Math.abs(line.bottom - rect.bottom) < 2 &&
                rect.left <= line.right + 1 &&
                rect.right >= line.left - 1,
            );
            if (line) {
              line.left = Math.min(line.left, rect.left);
              line.right = Math.max(line.right, rect.right);
            } else
              lines.push({
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
              });
          }
          const bounds = scope.getBoundingClientRect();
          for (const line of lines) {
            const left = Math.max(bounds.left, line.left - 2);
            const right = Math.min(bounds.right, line.right + 2);
            paint(container, left, line.top - 3, right - left, line.bottom - line.top + 6);
          }
        }
      });
    });
    return () => {
      backgrounds.forEach((background) => {
        background.hidden = true;
      });
      placements.forEach(({ container, left, top, width, height }, index) => {
        const background = (backgrounds[index] ||= document.createElement('div'));
        background.className = 'hand-range-background';
        background.setAttribute('aria-hidden', 'true');
        if (background.parentElement !== container) container.append(background);
        background.style.left = `${left}px`;
        background.style.top = `${top}px`;
        background.style.width = `${width}px`;
        background.style.height = `${height}px`;
        background.hidden = false;
      });
    };
  }
  const schedule = registerLayoutTask(positionBackground);

  function update() {
    const active = hovered || focused;
    if (active === highlighted) return;
    highlighted?.trigger.classList.remove('hand-range-active');
    active?.trigger.classList.add('hand-range-active');
    highlighted = active;
    schedule();
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hovered = null;
      focused = null;
      update();
    }
  });

  return (trigger: HTMLElement, groups: HandFragment[][] | (() => HandFragment[][])) => {
    // Search marks can split or merge text nodes; measure the current text.
    const range = {
      trigger,
      get groups() {
        return typeof groups === 'function' ? groups() : groups;
      },
    };
    trigger.classList.add('hand-range-trigger');
    trigger.addEventListener('pointerenter', () => {
      hovered = range;
      update();
    });
    trigger.addEventListener('pointerleave', () => {
      if (hovered === range) hovered = null;
      update();
    });
    trigger.addEventListener('focusin', () => {
      focused = range;
      update();
    });
    trigger.addEventListener('focusout', () => {
      if (focused === range) focused = null;
      update();
    });
  };
}
