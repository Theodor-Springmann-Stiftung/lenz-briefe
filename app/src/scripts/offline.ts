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
  const label = root.querySelector<HTMLElement>('[data-offline-status]')!;
  const progress = root.querySelector<HTMLProgressElement>('[data-offline-progress]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-offline-retry]')!;
  const announcement = root.querySelector<HTMLElement>('[data-offline-announcement]')!;
  const base = new URL(root.dataset.base!, location.origin);
  const script = new URL('sw.js', base);
  const preferenceKey = `lenz-offline-v1:${base.pathname}`;
  let registration: ServiceWorkerRegistration | undefined;
  let connecting: Promise<ServiceWorker> | undefined;
  let workerCheckedAt = 0;
  let desired = readPreference();
  let changing = false;
  let previousPhase = '';
  let latest: OfflineStatus | undefined;

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
    try { localStorage.setItem(preferenceKey, value ? 'enabled' : 'disabled'); }
    catch { /* The worker's persistent state also restores the preference. */ }
  }

  function render(status: OfflineStatus) {
    if (changing && status.enabled !== desired) return;
    if (!desired && (changing || explicitlyDisabled()) && status.enabled) return;
    latest = status;
    checkbox.checked = status.enabled;
    optionLabel.textContent = status.enabled && status.ready
      ? status.phase === 'downloading' ? 'Aktualisiere' : 'Offline verfügbar'
      : downloadLabel;
    feedback.hidden = !status.enabled || status.phase === 'ready';
    progress.hidden = status.phase !== 'downloading';
    retry.hidden = !['paused', 'error'].includes(status.phase);
    const percent = status.totalBytes ? Math.floor(status.bytes / status.totalBytes * 100) : 0;
    progress.value = percent;
    progress.title = `${status.done} / ${status.total} Dateien`;
    progress.setAttribute('aria-valuetext', `${percent} Prozent, ${status.done} von ${status.total} Dateien`);
    label.textContent = ['off', 'ready'].includes(status.phase) ? ''
      : status.phase === 'checking' ? (status.ready ? 'Prüft auf Updates …' : 'Wird vorbereitet …')
      : status.phase === 'downloading' ? `${percent} %`
      : status.error === 'quota' ? 'Speicher voll'
      : `Pausiert${status.total ? ` · ${percent} %` : ''}`;
    retry.textContent = status.error === 'quota' ? 'Erneut versuchen' : 'Fortsetzen';
    root.title = status.ready && status.updatedAt
      ? `Offline gespeichert: ${new Date(status.updatedAt).toLocaleString('de-DE')}` : '';
    // Announce state changes, not every downloaded file or percentage point.
    if (previousPhase !== status.phase) announcement.textContent = status.phase === 'downloading'
      ? `${optionLabel.textContent}: ${percent} Prozent` : label.textContent || optionLabel.textContent;
    previousPhase = status.phase;
  }

  function showFailure(error: unknown) {
    checkbox.checked = desired;
    optionLabel.textContent = desired && latest?.ready ? 'Offline verfügbar' : downloadLabel;
    feedback.hidden = false;
    progress.hidden = true;
    retry.hidden = !desired;
    label.textContent = error instanceof DOMException && error.name === 'QuotaExceededError'
      ? 'Speicher voll' : navigator.onLine ? 'Offline-Nutzung pausiert' : 'Zum Laden online gehen';
    announcement.textContent = label.textContent;
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
      worker.postMessage({ type, force, userInitiated }, [channel.port2]);
    });
  }

  async function synchronize(force = false) {
    if (!desired || changing) return;
    try {
      const status = await command('ENABLE', force);
      if (desired) render(status);
    } catch (error) { if (desired) showFailure(error); }
  }

  checkbox.addEventListener('change', async () => {
    remember(checkbox.checked);
    optionLabel.textContent = downloadLabel;
    changing = true;
    checkbox.disabled = true;
    feedback.hidden = false;
    progress.hidden = true;
    retry.hidden = true;
    label.textContent = desired ? 'Wird vorbereitet …' : 'Wird entfernt …';
    try {
      if (desired) {
        // A request made after this explicit interaction may reduce automatic
        // eviction. A denied request still permits best-effort offline use.
        navigator.storage?.persist?.().catch(() => {});
        render(await command('ENABLE', true, true));
      } else {
        render(await command('DISABLE'));
        registration = undefined;
      }
    } catch (error) { showFailure(error); }
    finally {
      changing = false;
      checkbox.disabled = false;
    }
  });
  retry.addEventListener('click', () => synchronize(true));
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'lenz:offline-status' || event.data.scope !== base.href) return;
    const status: OfflineStatus = event.data.status;
    // A queued status from the preceding toggle must not replace the new choice.
    if (changing && status.enabled !== desired) return;
    if (!status.enabled) remember(false);
    else if (!changing && !explicitlyDisabled()) remember(true);
    render(status);
  });
  window.addEventListener('online', () => {
    if (!desired) return;
    registration?.update().catch(() => {});
    synchronize(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') synchronize();
  });
  window.addEventListener('pageshow', () => synchronize());
  window.addEventListener('storage', (event) => {
    if (event.key !== preferenceKey) return;
    desired = event.newValue === 'enabled';
    if (desired) synchronize();
    else if (!changing) {
      checkbox.checked = false;
      optionLabel.textContent = downloadLabel;
      feedback.hidden = true;
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
      if (desired) await synchronize();
      else if (existing?.scope === base.href && existing.active?.scriptURL === script.href) {
        // A page may have been closed halfway through opting out. Its explicit
        // choice takes precedence over an older worker/cache status.
        if (explicitlyDisabled()) { render(await command('DISABLE')); return; }
        const status = await command('STATUS');
        if (changing) return;
        remember(status.enabled);
        render(status);
        if (status.enabled) await synchronize();
      }
    } catch (error) { if (desired || latest?.enabled) showFailure(error); }
  })();
}
