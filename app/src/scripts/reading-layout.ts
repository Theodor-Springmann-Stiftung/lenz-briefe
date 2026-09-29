import { createLayoutScheduler } from '../lib/layout-scheduler';

const scheduler = createLayoutScheduler((callback) => requestAnimationFrame(callback));
const onScroll = new Set<() => void>();
const observer = new ResizeObserver(() => scheduler.scheduleAll());

window.addEventListener('resize', () => scheduler.scheduleAll());
document.fonts.addEventListener('loadingdone', () => scheduler.scheduleAll());
document.fonts.ready.then(() => scheduler.scheduleAll());
document.addEventListener('scroll', () => onScroll.forEach((schedule) => schedule()), {
  capture: true,
  passive: true,
});

/** A decoration may return a write callback, keeping all its measurements together. */
export function registerLayoutTask(
  update: () => void | (() => void),
  {
    phase = 'decorate',
    observe = [],
    scroll = false,
  }: {
    phase?: 'arrange' | 'decorate';
    observe?: Element[];
    scroll?: boolean;
  } = {},
) {
  const schedule = scheduler.register(update, phase);
  observe.forEach((element) => observer.observe(element));
  if (scroll) onScroll.add(schedule);
  return schedule;
}
