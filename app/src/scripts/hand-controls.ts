import { createHandRangeHighlighter, handGroups, implicitHandGroups } from './hand-ranges';

export function initializeHandControls(layout: HTMLElement) {
  const allHandGroups = [
    ...document.querySelectorAll<HTMLElement>(
      '.letter-body, .margin-note, .unplaced-note, .inpos-note',
    ),
  ].flatMap((container) => handGroups(container));
  const groupsForHand = (ref: string | undefined) => [
    ...allHandGroups.filter((fragments) => fragments[0].dataset.ref === ref),
    ...(ref && ref === layout.dataset.baseHand
      ? [
          ...document.querySelectorAll<HTMLElement>(
            '.letter-body, .margin-note > .edition-text, .unplaced-note > .edition-text, .inpos-note > .edition-text',
          ),
        ].flatMap((container) => implicitHandGroups(container))
      : []),
  ];
  const highlightHand = createHandRangeHighlighter();
  document
    .querySelectorAll<HTMLElement>(
      '.hand-label [data-hand-ref], .sidenote-details [data-hand-ref], .hand-key [data-hand-ref]',
    )
    .forEach((trigger) => {
      highlightHand(trigger, () => groupsForHand(trigger.dataset.handRef));
    });
}
