// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

/** Give input and painting a turn without relying on microtask-only awaits. */
export function yieldPrintWork() {
  if (globalThis.scheduler?.yield) return globalThis.scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Share a small work budget across preparation passes. Most checkpoints return
 * immediately; only an exhausted budget schedules another browser task. */
export function printCheckpoint() {
  let deadline = performance.now() + 12;
  return (force = false) => {
    if (!force && performance.now() < deadline) return;
    return yieldPrintWork().then(() => { deadline = performance.now() + 12; });
  };
}
