// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

/** Allow slow clients five minutes, or ten seconds per selected letter. */
export function printTimeout(letterCount = 1) {
  return Math.max(300_000, letterCount * 10_000);
}

/** A progressing export can run longer than its initial timeout. Repeated
 * notifications of the same position do not keep a stalled export alive. */
export function printWatchdog(timeoutMs, onTimeout) {
  let stopped = false;
  let pages = 0;
  let fraction = 0;
  const expire = () => { stopped = true; onTimeout(); };
  let timer = setTimeout(expire, timeoutMs);
  return {
    progress(progress) {
      if (stopped) return;
      if (progress.pages <= pages && progress.fraction <= fraction) return;
      pages = Math.max(pages, progress.pages);
      fraction = Math.max(fraction, progress.fraction);
      clearTimeout(timer);
      timer = setTimeout(expire, timeoutMs);
    },
    stop() { stopped = true; clearTimeout(timer); },
  };
}
