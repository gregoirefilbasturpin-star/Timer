/**
 * Moteur d'exécution pur : aucune dépendance au navigateur, chaque action
 * retourne le nouvel état et les événements à jouer (sons, voix, vibrations).
 *
 * Le temps est calculé à partir d'horodatages absolus (`endsAt`) et non d'un
 * compteur incrémenté : un onglet ralenti ou mis en arrière-plan se recale
 * sur l'heure réelle au tick suivant, sans dérive.
 */
import { flatten, type FlatStep, type FlattenOptions } from '../model/flatten';
import type { Workout } from '../model/types';

export type RunStatus = 'ready' | 'running' | 'paused' | 'finished';

export interface Run {
  workoutId: string;
  workoutName: string;
  steps: FlatStep[];
  /** Secondes. */
  totalDuration: number;
  index: number;
  status: RunStatus;
  /** Fin de l'étape courante (ms epoch), uniquement en cours d'exécution. */
  endsAt: number | null;
  /** Temps restant de l'étape quand elle n'est pas en cours d'exécution. */
  remainingMs: number;
  /** Durée de l'étape courante, temps ajouté compris. */
  stepTotalMs: number;
  /** Dernière seconde du décompte déjà signalée pour l'étape courante. */
  lastCountdown: number | null;
}

export type RunEvent =
  | { type: 'step'; index: number; late: number }
  | { type: 'countdown'; value: number }
  | { type: 'finished'; late: number };

export interface Transition {
  run: Run;
  events: RunEvent[];
}

export const COUNTDOWN_FROM = 3;
/** En dessous de ce temps écoulé, « précédent » revient à l'étape d'avant au lieu de relancer l'étape. */
const RESTART_THRESHOLD_MS = 3000;

const unchanged = (run: Run): Transition => ({ run, events: [] });

export function createRunFromSteps(workoutId: string, workoutName: string, steps: FlatStep[]): Run | null {
  if (steps.length === 0) return null;
  const ms = steps[0].duration * 1000;
  return {
    workoutId,
    workoutName,
    steps,
    totalDuration: steps.reduce((sum, s) => sum + s.duration, 0),
    index: 0,
    status: 'ready',
    endsAt: null,
    remainingMs: ms,
    stepTotalMs: ms,
    lastCountdown: null,
  };
}

export function createRun(workout: Workout, options: FlattenOptions): Run | null {
  return createRunFromSteps(workout.id, workout.name, flatten(workout, options));
}

export function resetRun(run: Run): Run {
  return createRunFromSteps(run.workoutId, run.workoutName, run.steps) ?? run;
}

export function remainingMs(run: Run, now: number): number {
  return run.status === 'running' && run.endsAt !== null ? Math.max(0, run.endsAt - now) : run.remainingMs;
}

function enterStep(run: Run, index: number, startsAt: number): Run {
  const ms = run.steps[index].duration * 1000;
  return {
    ...run,
    index,
    stepTotalMs: ms,
    lastCountdown: null,
    remainingMs: ms,
    endsAt: run.status === 'running' ? startsAt + ms : null,
  };
}

function finish(run: Run): Run {
  return { ...run, status: 'finished', endsAt: null, remainingMs: 0, lastCountdown: null };
}

export function start(run: Run, now: number): Transition {
  if (run.status !== 'ready') return resume(run, now);
  return {
    run: { ...run, status: 'running', endsAt: now + run.remainingMs },
    events: [{ type: 'step', index: run.index, late: 0 }],
  };
}

export function pause(run: Run, now: number): Transition {
  if (run.status !== 'running') return unchanged(run);
  return unchanged({ ...run, status: 'paused', remainingMs: remainingMs(run, now), endsAt: null });
}

export function resume(run: Run, now: number): Transition {
  if (run.status !== 'paused') return unchanged(run);
  return unchanged({ ...run, status: 'running', endsAt: now + run.remainingMs });
}

export function tick(run: Run, now: number): Transition {
  if (run.status !== 'running' || run.endsAt === null) return unchanged(run);
  const events: RunEvent[] = [];
  let r = run;

  // Boucle : plusieurs étapes peuvent s'être terminées pendant une mise en arrière-plan.
  while (r.status === 'running' && r.endsAt !== null && r.endsAt <= now) {
    const boundary = r.endsAt;
    if (r.index >= r.steps.length - 1) {
      r = finish(r);
      events.push({ type: 'finished', late: now - boundary });
    } else {
      r = enterStep(r, r.index + 1, boundary);
      events.push({ type: 'step', index: r.index, late: now - boundary });
    }
  }

  if (r.status === 'running' && r.endsAt !== null) {
    const left = r.endsAt - now;
    const second = Math.ceil(left / 1000);
    // Pas de bip pour une seconde égale à la durée de l'étape (elle vient de commencer).
    if (second >= 1 && second <= COUNTDOWN_FROM && second !== r.lastCountdown && second * 1000 < r.stepTotalMs) {
      r = { ...r, lastCountdown: second };
      events.push({ type: 'countdown', value: second });
    }
  }
  return { run: r, events };
}

export function next(run: Run, now: number): Transition {
  if (run.status === 'finished') return unchanged(run);
  if (run.index >= run.steps.length - 1) return { run: finish(run), events: [{ type: 'finished', late: 0 }] };
  const r = enterStep(run, run.index + 1, now);
  return { run: r, events: r.status === 'running' ? [{ type: 'step', index: r.index, late: 0 }] : [] };
}

export function previous(run: Run, now: number): Transition {
  if (run.status === 'finished') return unchanged(run);
  const elapsed = run.stepTotalMs - remainingMs(run, now);
  const index = elapsed > RESTART_THRESHOLD_MS || run.index === 0 ? run.index : run.index - 1;
  const r = enterStep(run, index, now);
  return { run: r, events: r.status === 'running' ? [{ type: 'step', index, late: 0 }] : [] };
}

export function addTime(run: Run, now: number, ms: number): Transition {
  if (run.status === 'finished') return unchanged(run);
  const r: Run = { ...run, stepTotalMs: run.stepTotalMs + ms, lastCountdown: null };
  if (run.status === 'running' && run.endsAt !== null) r.endsAt = run.endsAt + ms;
  else r.remainingMs = run.remainingMs + ms;
  return unchanged(remainingMs(r, now) > COUNTDOWN_FROM * 1000 ? r : { ...r, lastCountdown: run.lastCountdown });
}

export interface Progress {
  /** 0 → 1, position dans la séance. */
  ratio: number;
  remainingTotalMs: number;
}

export function progress(run: Run, now: number): Progress {
  if (run.status === 'finished') return { ratio: 1, remainingTotalMs: 0 };
  const step = run.steps[run.index];
  const left = remainingMs(run, now);
  const fraction = run.stepTotalMs > 0 ? (run.stepTotalMs - left) / run.stepTotalMs : 0;
  const done = step.offset + fraction * step.duration;
  return {
    ratio: run.totalDuration > 0 ? Math.min(1, done / run.totalDuration) : 0,
    remainingTotalMs: (run.totalDuration - step.offset - step.duration) * 1000 + left,
  };
}

/** État à sauvegarder : une séance en cours est figée en pause avec son temps restant. */
export function toStored(run: Run, now: number): Run {
  return run.status === 'running' ? pause(run, now).run : run;
}
