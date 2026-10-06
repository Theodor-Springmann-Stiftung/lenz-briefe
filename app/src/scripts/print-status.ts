// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

import type { PrintProgress } from '../lib/print-html';

export function printStatus(element: HTMLElement | null) {
  const message = element?.querySelector<HTMLElement>('[data-print-message]');
  const bar = element?.querySelector<HTMLProgressElement>('[data-print-progress]');
  let previousProgress = '';
  const show = (text: string) => {
    if (element) element.hidden = false;
    if (message) message.textContent = text;
  };
  const stop = () => {
    previousProgress = '';
    element?.classList.remove('is-preparing');
    if (bar) bar.hidden = true;
  };
  return {
    start(text: string) {
      previousProgress = '';
      show(text);
      element?.classList.add('is-preparing');
      if (bar) { bar.hidden = true; bar.value = 0; }
    },
    progress({ fraction, pages }: PrintProgress) {
      const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
      const position = `${fraction >= 1}:${percent}:${pages}`;
      if (position === previousProgress) return;
      previousProgress = position;
      show(`${fraction >= 1 ? 'Druck wird abgeschlossen' : 'Druck wird vorbereitet'} … ${percent} % · ${pages} ${pages === 1 ? 'Seite' : 'Seiten'}`);
      if (bar) { bar.hidden = false; bar.value = percent; }
    },
    hide() { stop(); if (element) element.hidden = true; },
    error(text: string) { stop(); show(text); },
    stop,
  };
}
