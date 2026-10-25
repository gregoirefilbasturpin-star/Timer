import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let installEvent: BeforeInstallPromptEvent | null = null;
let updateReady = false;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e as BeforeInstallPromptEvent;
  notify();
});

window.addEventListener('appinstalled', () => {
  installEvent = null;
  notify();
});

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateReady = true;
    notify();
  },
});

export function useInstallAvailable(): boolean {
  return useSyncExternalStore(subscribe, () => installEvent !== null);
}

export async function promptInstall(): Promise<void> {
  const event = installEvent;
  if (!event) return;
  installEvent = null;
  notify();
  await event.prompt();
}

export function useUpdateReady(): boolean {
  return useSyncExternalStore(subscribe, () => updateReady);
}

export function applyUpdate(): void {
  void updateSW(true);
}
