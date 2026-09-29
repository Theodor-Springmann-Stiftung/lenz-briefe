// INFO: this aallows for calcucalting positions and scheduling placement of items on the page seperately.
// So all our items (margin sidenotes, pages, hands) can first calculate, then draw at once.
type Update = () => void | (() => void);
type Phase = 'arrange' | 'decorate';

/** Coalesce updates; measure decorations only after margin placement has finished. */
export function createLayoutScheduler(requestFrame: (callback: () => void) => void) {
  const tasks = new Map<Update, Phase>();
  const pending = new Set<Update>();
  let scheduled = false;

  function flush() {
    scheduled = false;
    const current = new Set(pending);
    pending.clear();
    if ([...current].some((task) => tasks.get(task) === 'arrange')) {
      for (const [task, phase] of tasks) if (phase === 'decorate') current.add(task);
    }
    for (const task of current) {
      if (tasks.get(task) === 'arrange') task();
    }
    const writes: (() => void)[] = [];
    for (const task of current) {
      if (tasks.get(task) !== 'decorate') continue;
      const write = task();
      if (write) writes.push(write);
    }
    writes.forEach((write) => write());
  }

  function schedule(task: Update) {
    pending.add(task);
    if (scheduled) return;
    scheduled = true;
    requestFrame(flush);
  }

  return {
    register(task: Update, phase: Phase = 'decorate') {
      tasks.set(task, phase);
      schedule(task);
      return () => schedule(task);
    },
    scheduleAll() {
      for (const task of tasks.keys()) schedule(task);
    },
  };
}
