// Écran allumé (Wake Lock) et vibrations.

let sentinel: WakeLockSentinel | null = null;
let wanted = false;

async function requestWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    sentinel = null;
  }
}

// Le navigateur libère le verrou quand l'app passe en arrière-plan : on le reprend au retour.
document.addEventListener('visibilitychange', () => {
  if (wanted && !sentinel && document.visibilityState === 'visible') void requestWakeLock();
});

export const wakeLock = {
  async acquire(): Promise<void> {
    wanted = true;
    if (!sentinel) await requestWakeLock();
  },
  async release(): Promise<void> {
    wanted = false;
    const current = sentinel;
    sentinel = null;
    await current?.release().catch(() => {});
  },
};

export function vibrate(pattern: number | number[]): void {
  navigator.vibrate?.(pattern);
}
