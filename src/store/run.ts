import { create } from 'zustand';
import * as engine from '../engine/engine';
import type { Run, Transition } from '../engine/engine';
import { feedback } from '../services/feedback';

const STORAGE_KEY = 'timer.activeRun';
const TICK_SAVE_INTERVAL_MS = 1000;

export function loadStoredRun(): Run | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as Run;
    return Array.isArray(run?.steps) && run.steps.length > 0 && run.index < run.steps.length ? run : null;
  } catch {
    return null;
  }
}

export function clearStoredRun(): void {
  localStorage.removeItem(STORAGE_KEY);
}

let lastSave = 0;

/** Sauvegarde la séance pour pouvoir la reprendre si l'app est fermée. */
function persist(run: Run | null, now: number): void {
  lastSave = now;
  if (!run || run.status === 'ready') return;
  if (run.status === 'finished') clearStoredRun();
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(engine.toStored(run, now)));
}

interface RunStore {
  run: Run | null;
  /** Horodatage du dernier calcul, sert à rafraîchir l'affichage. */
  now: number;
}

export const useRun = create<RunStore>(() => ({ run: null, now: Date.now() }));

function apply(fn: (run: Run, now: number) => Transition, { fromTick = false } = {}): void {
  const { run } = useRun.getState();
  if (!run) return;
  const now = Date.now();
  const { run: next, events } = fn(run, now);
  useRun.setState({ run: next, now });
  if (events.length) feedback.handle(events, next);
  if (!fromTick || events.length || next.status !== run.status || now - lastSave >= TICK_SAVE_INTERVAL_MS) persist(next, now);
}

export const runActions = {
  load(run: Run): void {
    useRun.setState({ run, now: Date.now() });
  },
  start: () => apply(engine.start),
  toggle(): void {
    const run = useRun.getState().run;
    if (run?.status === 'running') {
      feedback.stop();
      apply(engine.pause);
    } else {
      apply(engine.resume);
    }
  },
  next: () => apply(engine.next),
  previous: () => apply(engine.previous),
  addTime: (ms: number) => apply((run, now) => engine.addTime(run, now, ms)),
  tick: () => apply(engine.tick, { fromTick: true }),
  restart(): void {
    const run = useRun.getState().run;
    if (run) useRun.setState({ run: engine.resetRun(run), now: Date.now() });
  },
  persistNow(): void {
    persist(useRun.getState().run, Date.now());
  },
  /** Sortie de l'écran de séance : met en pause et garde la séance pour une reprise. */
  leave(): void {
    feedback.stop();
    apply(engine.pause);
    useRun.setState({ run: null });
  },
  quit(): void {
    feedback.stop();
    clearStoredRun();
    useRun.setState({ run: null });
  },
};
