interface OfflineStatus {
  enabled: boolean;
  phase: 'off' | 'checking' | 'downloading' | 'ready' | 'paused' | 'error';
  done: number;
  total: number;
  bytes: number;
  totalBytes: number;
  ready: boolean;
  version: string | null;
  updatedAt: number;
  error: 'network' | 'quota' | 'changed' | null;
}

const root = document.querySelector<HTMLElement>('[data-offline]');
if (root) initializeOfflineControl(root);

function initializeOfflineControl(root: HTMLElement) {
  const checkbox = root.querySelector<HTMLInputElement>('[data-offline-toggle]')!;
  const optionLabel = root.querySelector<HTMLElement>('[data-offline-label]')!;
  const downloadLabel = optionLabel.textContent!;
  const feedback = root.querySelector<HTMLElement>('.offline-feedback')!;
  const progress = root.querySelector<HTMLProgressElement>('[data-offline-progress]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-offline-retry]')!;
  const reload = root.querySelector<HTMLAnchorElement>('[data-offline-reload]')!;
  const pageVersion = root.dataset.offlineVersion;
  const announcement = root.querySelector<HTMLElement>('[data-offline-announcement]')!;
  const base = new URL(root.dataset.base!, location.origin);
  const script = new URL('sw.js', base);
  const preferenceKey = `lenz-offline-v1:${base.pathname}`;
  let registration: ServiceWorkerRegistration | undefined;
  let connecting: Promise<ServiceWorker> | undefined;
  let workerCheckedAt = 0;
  let desired = readPreference();
  let optedOut = explicitlyDisabled();
  let changing = false;
  let previousPhase = '';
  let latest: OfflineStatus | undefined;
  let completedVersion: string | null = null;
  let recoveryTimer: number | undefined;
  let recoveryAttempt = 0;
  let recoveryNeeded = false;
  const maxRecoveryAttempts = 5;

  root.hidden = false;
  if (root.dataset.production !== 'true') {
    checkbox.disabled = true;
    root.title = 'Offline-Nutzung ist in der gebauten Website und der Build-Vorschau verfügbar.';
    return;
  }
  if (!isSecureContext || !('serviceWorker' in navigator) || !('caches' in window)) {
    checkbox.disabled = true;
    root.title = 'Offline-Nutzung ist in diesem Browser nicht verfügbar.';
    return;
  }

  function readPreference() {
    try { return localStorage.getItem(preferenceKey) === 'enabled'; }
    catch { return false; }
  }

  function explicitlyDisabled() {
    try { return localStorage.getItem(preferenceKey) === 'disabled'; }
    catch { return false; }
  }

  function remember(value: boolean) {
    desired = value;
    optedOut = !value;
    try { localStorage.setItem(preferenceKey, value ? 'enabled' : 'disabled'); }
    catch { /* The worker's persistent state also restores the preference. */ }
  }

  function forgetPreference() {
    // Keep the disabled marker only while removal is pending, so closing the
    // page midway through cleanup can resume it. Completed opt-outs leave no
    // local storage behind; optedOut still rejects queued worker messages.
    if (localStorage.getItem(preferenceKey) === 'disabled') localStorage.removeItem(preferenceKey);
  }

  async function removeOfflineData() {
    const existing = await navigator.serviceWorker.getRegistration(base.href);
    const ownsRegistration = existing?.scope === base.href
      && [existing.active, existing.waiting, existing.installing].some((worker) => worker?.scriptURL === script.href);
    if (ownsRegistration) {
      render(await command('DISABLE'));
    } else {
      // Orphaned caches can remain after a worker was removed externally.
      // Deleting them must also work offline, without installing a new worker.
      const prefix = `${preferenceKey}:`;
      for (const name of await window.caches.keys()) {
        if (name.startsWith(prefix)) await window.caches.delete(name);
      }
    }
    forgetPreference();
    registration = undefined;
  }

  function clearRecovery(reset = false) {
    if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
    recoveryTimer = undefined;
    if (reset) recoveryAttempt = 0;
  }

  function scheduleRecovery() {
    if (!desired || !recoveryNeeded || recoveryAttempt >= maxRecoveryAttempts
      || !navigator.onLine || recoveryTimer !== undefined) return;
    // The page can wake a stopped worker; saved cache entries survive both
    // navigation and worker suspension. Back off during a prolonged outage.
    const delay = Math.min(5000 * 2 ** recoveryAttempt, 60000);
    recoveryTimer = window.setTimeout(() => {
      recoveryTimer = undefined;
      recoveryAttempt++;
      synchronize(true);
    }, delay);
  }

  function recoveryLabel() {
    const percent = latest?.totalBytes ? Math.floor(latest.bytes / latest.totalBytes * 100) : undefined;
    const text = recoveryAttempt >= maxRecoveryAttempts ? 'Pausiert'
      : navigator.onLine ? 'Wird fortgesetzt …' : 'Warte auf Verbindung …';
    return `${text}${percent === undefined ? '' : ` · ${percent} %`}`;
  }

  function render(status: OfflineStatus) {
    if (changing && status.enabled !== desired) return;
    if (!desired && (changing || optedOut) && status.enabled) return;
    if (latest && status.done > latest.done) recoveryAttempt = 0;
    latest = status;
    if (status.phase === 'ready' && status.ready) completedVersion = status.version;
    recoveryNeeded = status.enabled && ['paused', 'error'].includes(status.phase) && status.error !== 'quota';
    const recovering = recoveryNeeded && recoveryAttempt < maxRecoveryAttempts;
    const wasUpdated = !reload.hidden;
    const updated = status.enabled && status.ready && completedVersion === status.version
      && Boolean(pageVersion && status.version && pageVersion !== status.version);
    if (recoveryNeeded) scheduleRecovery();
    else clearRecovery(['off', 'ready'].includes(status.phase));
    checkbox.checked = status.enabled;
    progress.hidden = status.phase !== 'downloading' && !(recovering && status.total);
    retry.hidden = !status.enabled || !['paused', 'error'].includes(status.phase) || recovering;
    reload.hidden = !updated;
    reload.href = location.href;
    feedback.hidden = progress.hidden && retry.hidden && reload.hidden;
    const percent = status.totalBytes ? Math.floor(status.bytes / status.totalBytes * 100) : 0;
    progress.value = percent;
    progress.title = `${status.done} / ${status.total} Dateien`;
    progress.setAttribute('aria-valuetext', `${percent} Prozent, ${status.done} von ${status.total} Dateien`);
    optionLabel.textContent = !status.enabled || status.phase === 'off' ? downloadLabel
      : status.phase === 'ready' || (updated && status.phase === 'checking') ? (updated ? 'Aktualisiert' : 'Offline verfügbar')
      : status.phase === 'checking' ? (status.ready ? 'Prüft auf Updates …' : 'Wird vorbereitet …')
      : status.phase === 'downloading' ? `${status.ready ? 'Aktualisiere' : 'Download'} · ${percent} %`
      : status.error === 'quota' ? 'Speicher voll'
      : recoveryLabel();
    retry.textContent = status.error === 'quota' ? 'Erneut versuchen' : 'Fortsetzen';
    root.title = status.ready && status.updatedAt
      ? `Offline gespeichert: ${new Date(status.updatedAt).toLocaleString('de-DE')}` : '';
    // Announce state changes, not every downloaded file or percentage point.
    if (previousPhase !== status.phase || wasUpdated !== updated) {
      announcement.textContent = `${optionLabel.textContent}${updated ? ' · Neu laden' : ''}`;
    }
    previousPhase = status.phase;
  }

  function showFailure(error: unknown) {
    const quota = error instanceof DOMException && error.name === 'QuotaExceededError';
    recoveryNeeded = desired && !quota;
    if (recoveryNeeded) scheduleRecovery();
    else clearRecovery();
    checkbox.checked = desired;
    progress.hidden = true;
    retry.hidden = !desired || (!quota && recoveryAttempt < maxRecoveryAttempts);
    feedback.hidden = retry.hidden && reload.hidden;
    retry.textContent = quota ? 'Erneut versuchen' : 'Fortsetzen';
    optionLabel.textContent = quota ? 'Speicher voll'
      : desired ? recoveryLabel() : 'Entfernen fehlgeschlagen';
    announcement.textContent = optionLabel.textContent;
  }

  async function activeWorker(reg: ServiceWorkerRegistration): Promise<ServiceWorker> {
    if (reg.active) return reg.active;
    const candidate = reg.installing || reg.waiting;
    if (!candidate) throw new Error('No service worker');
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => finish(new Error('Service worker activation timed out')), 20000);
      const changed = () => {
        if (candidate.state === 'activated') finish();
        else if (candidate.state === 'redundant') finish(new Error('Service worker installation failed'));
      };
      function finish(error?: Error) {
        clearTimeout(timeout);
        candidate!.removeEventListener('statechange', changed);
        if (error) reject(error);
        else resolve(reg.active || candidate!);
      }
      candidate.addEventListener('statechange', changed);
      changed();
    });
  }

  function connect(): Promise<ServiceWorker> {
    if (connecting) return connecting;
    connecting = (async () => {
      const existing = await navigator.serviceWorker.getRegistration(base.href);
      const ownsRegistration = existing?.scope === base.href
        && [existing.active, existing.waiting, existing.installing].some((worker) => worker?.scriptURL === script.href);
      registration = ownsRegistration ? existing
        : await navigator.serviceWorker.register(script.href, { scope: base.href, updateViaCache: 'none' });
      if (ownsRegistration && navigator.onLine && Date.now() - workerCheckedAt > 60000) {
        workerCheckedAt = Date.now();
        registration!.update().catch(() => {});
      }
      return activeWorker(registration!);
    })();
    connecting.finally(() => { connecting = undefined; }).catch(() => {});
    return connecting;
  }

  async function command(type: 'STATUS' | 'ENABLE' | 'SYNC' | 'DISABLE', force = false, userInitiated = false) {
    const worker = await connect();
    return new Promise<OfflineStatus>((resolve, reject) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => {
        channel.port1.close();
        reject(new Error('Offline worker did not reply'));
      }, 25000);
      channel.port1.onmessage = ({ data }) => {
        clearTimeout(timeout);
        channel.port1.close();
        if (data.error) reject(new DOMException('Offline operation failed', data.error));
        else resolve(data.status);
      };
      // Check before comparing versions: a network-loaded page can already be
      // newer than the saved edition, so it must not be told to reload that one.
      const checkVersion = Boolean(pageVersion && pageVersion !== latest?.version);
      worker.postMessage({ type, force: force || checkVersion, userInitiated }, [channel.port2]);
    });
  }

  async function synchronize(force = false) {
    if (!desired || changing) return;
    if (!force && (recoveryTimer !== undefined || !retry.hidden)) return;
    clearRecovery();
    try {
      const status = await command('ENABLE', force);
      if (desired) render(status);
    } catch (error) { if (desired) showFailure(error); }
  }

  checkbox.addEventListener('change', async () => {
    remember(checkbox.checked);
    clearRecovery(true);
    recoveryNeeded = false;
    changing = true;
    checkbox.disabled = true;
    feedback.hidden = true;
    progress.hidden = true;
    retry.hidden = true;
    reload.hidden = true;
    optionLabel.textContent = desired ? 'Wird vorbereitet …' : 'Wird entfernt …';
    announcement.textContent = optionLabel.textContent;
    try {
      if (desired) {
        // A request made after this explicit interaction may reduce automatic
        // eviction. A denied request still permits best-effort offline use.
        navigator.storage?.persist?.().catch(() => {});
        render(await command('ENABLE', true, true));
      } else {
        await removeOfflineData();
        optionLabel.textContent = downloadLabel;
      }
    } catch (error) { showFailure(error); }
    finally {
      changing = false;
      checkbox.disabled = false;
      scheduleRecovery();
    }
  });
  retry.addEventListener('click', () => { clearRecovery(true); synchronize(true); });
  reload.addEventListener('click', (event) => {
    reload.href = location.href;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    location.reload();
  });
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'lenz:offline-status' || event.data.scope !== base.href) return;
    const status: OfflineStatus = event.data.status;
    // A queued status from the preceding toggle must not replace the new choice.
    if (changing && status.enabled !== desired) return;
    if (!status.enabled) {
      remember(false);
      // An off broadcast is sent only after the worker has removed its data.
      try { forgetPreference(); } catch (error) { showFailure(error); return; }
    } else if (!changing && !optedOut) remember(true);
    render(status);
  });
  window.addEventListener('online', () => {
    if (!desired) return;
    if (!retry.hidden) return;
    clearRecovery(true);
    registration?.update().catch(() => {});
    synchronize(true);
  });
  window.addEventListener('offline', () => {
    clearRecovery();
    if (recoveryNeeded) {
      optionLabel.textContent = recoveryLabel();
      announcement.textContent = optionLabel.textContent;
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') synchronize();
  });
  window.addEventListener('pageshow', () => synchronize());
  window.addEventListener('storage', (event) => {
    if (event.key !== preferenceKey) return;
    desired = event.newValue === 'enabled';
    optedOut = !desired;
    if (desired) synchronize();
    else if (!changing) {
      clearRecovery(true);
      recoveryNeeded = false;
      checkbox.checked = false;
      optionLabel.textContent = downloadLabel;
      feedback.hidden = true;
      reload.hidden = true;
    }
  });
  // Also restarts a suspended worker. Persisted cache entries, not this timer,
  // determine which files still need downloading.
  window.setInterval(() => {
    if (document.visibilityState === 'visible' && desired && navigator.onLine) synchronize();
  }, 60000);

  (async () => {
    checkbox.checked = desired;
    try {
      const existing = await navigator.serviceWorker.getRegistration(base.href);
      if (changing) return;
      if (desired) await synchronize();
      else if (explicitlyDisabled()) await removeOfflineData();
      else if (existing?.scope === base.href && existing.active?.scriptURL === script.href) {
        // Restore the worker's choice if local storage was unavailable.
        const status = await command('STATUS');
        if (changing) return;
        remember(status.enabled);
        if (!status.enabled) forgetPreference();
        render(status);
        if (status.enabled) await synchronize();
      }
    } catch (error) { if (desired || optedOut || latest?.enabled) showFailure(error); }
  })();
}
