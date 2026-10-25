import { KIND_LABELS, NAMED_KINDS, type StepKind, type StepNode, type Workout, type WorkoutNode } from './types';

export interface RoundInfo {
  label: string;
  current: number;
  total: number;
}

/** Étape exécutable, une fois les blocs et répétitions déroulés. */
export interface FlatStep {
  kind: StepKind;
  label: string;
  /** Secondes. */
  duration: number;
  description?: string;
  load?: string;
  /** Tours en cours, du bloc le plus externe au plus interne (blocs à 1 tour exclus). */
  rounds: RoundInfo[];
  /** Secondes écoulées depuis le début de la séance au démarrage de l'étape. */
  offset: number;
  /** Repos inséré automatiquement entre deux tours d'un bloc. */
  betweenRounds?: boolean;
}

export function stepLabel(step: Pick<StepNode, 'kind' | 'name'>): string {
  const name = step.name.trim();
  return NAMED_KINDS.has(step.kind) && name ? name : KIND_LABELS[step.kind];
}

type PendingStep = Omit<FlatStep, 'offset'>;

export interface FlattenOptions {
  /** Au dernier tour de chaque bloc, supprime le repos final (réglage global). */
  skipLastRest: boolean;
}

function expand(nodes: WorkoutNode[], rounds: RoundInfo[], out: PendingStep[], options: FlattenOptions): void {
  for (const node of nodes) {
    if (node.type === 'step') {
      if (node.duration <= 0) continue;
      out.push({
        kind: node.kind,
        label: stepLabel(node),
        duration: node.duration,
        // Description et charge ne sont saisissables que pour travail / étirement.
        description: (NAMED_KINDS.has(node.kind) && node.description?.trim()) || undefined,
        load: (NAMED_KINDS.has(node.kind) && node.load?.trim()) || undefined,
        rounds,
      });
      continue;
    }

    const total = Math.max(1, Math.floor(node.rounds));
    const label = node.name.trim() || 'Tour';
    for (let current = 1; current <= total; current++) {
      const info = total > 1 ? [...rounds, { label, current, total }] : rounds;
      const roundSteps: PendingStep[] = [];
      expand(node.children, info, roundSteps, options);
      if (current === total && options.skipLastRest && roundSteps.at(-1)?.kind === 'rest') roundSteps.pop();
      out.push(...roundSteps);
      if (current < total && node.restBetweenRounds > 0) {
        out.push({ kind: 'rest', label: KIND_LABELS.rest, duration: node.restBetweenRounds, rounds: info, betweenRounds: true });
      }
    }
  }
}

export function flattenNodes(nodes: WorkoutNode[], options: FlattenOptions): FlatStep[] {
  const pending: PendingStep[] = [];
  expand(nodes, [], pending, options);
  let offset = 0;
  return pending.map((step) => {
    const flat = { ...step, offset };
    offset += step.duration;
    return flat;
  });
}

export function flatten(workout: Workout, options: FlattenOptions): FlatStep[] {
  return flattenNodes(workout.children, options);
}

export function totalDuration(nodes: WorkoutNode[], options: FlattenOptions): number {
  return flattenNodes(nodes, options).reduce((sum, s) => sum + s.duration, 0);
}
