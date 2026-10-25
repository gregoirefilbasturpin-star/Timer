import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'edit'; id: string }
  | { name: 'run'; id?: string }
  | { name: 'settings' };

/**
 * Routage par hash : `#/edit/:id`, `#/run/:id`, `#/run` (reprise), `#/settings`.
 * L'historique du navigateur est utilisé pour que le geste « retour »
 * d'Android ramène à l'accueil.
 */
export function parseHash(hash: string): Route {
  const [, name, id] = hash.replace(/^#/, '').split('/');
  if (name === 'edit' && id) return { name: 'edit', id };
  if (name === 'run') return id ? { name: 'run', id } : { name: 'run' };
  if (name === 'settings') return { name: 'settings' };
  return { name: 'home' };
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

window.addEventListener('popstate', notify);
window.addEventListener('hashchange', notify);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return parseHash(hash);
}

export function navigate(path: string, { replace = false } = {}): void {
  const state = replace ? history.state : { inApp: true };
  if (replace) history.replaceState(state, '', `#${path}`);
  else history.pushState(state, '', `#${path}`);
  notify();
}

/** Revient à l'écran précédent de l'app, ou à l'accueil si l'app a été ouverte directement ici. */
export function goBack(): void {
  if (history.state?.inApp) history.back();
  else navigate('/', { replace: true });
}
