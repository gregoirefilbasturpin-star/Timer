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

function expand(nodes: WorkoutNode[], rounds: RoundInfo[], out: PendingStep[]): void {
  for (const node of nodes) {
    if (node.type === 'step') {
      if (node.duration <= 0) continue;
      out.push({
        kind: node.kind,
        label: stepLabel(node),
        duration: node.duration,
        description: node.description?.trim() || undefined,
        load: node.load?.trim() || undefined,
        rounds,
      });
      continue;
    }

    const total = Math.max(1, Math.floor(node.rounds));
    const label = node.name.trim() || 'Tour';
    for (let current = 1; current <= total; current++) {
      const info = total > 1 ? [...rounds, { label, current, total }] : rounds;
      const roundSteps: PendingStep[] = [];
      expand(node.children, info, roundSteps);
      if (current === total && node.skipLastRest && roundSteps.at(-1)?.kind === 'rest') roundSteps.pop();
      out.push(...roundSteps);
      if (current < total && node.restBetweenRounds > 0) {
        out.push({ kind: 'rest', label: KIND_LABELS.rest, duration: node.restBetweenRounds, rounds: info, betweenRounds: true });
      }
    }
  }
}

export function flattenNodes(nodes: WorkoutNode[]): FlatStep[] {
  const pending: PendingStep[] = [];
  expand(nodes, [], pending);
  let offset = 0;
  return pending.map((step) => {
    const flat = { ...step, offset };
    offset += step.duration;
    return flat;
  });
}

export function flatten(workout: Workout): FlatStep[] {
  return flattenNodes(workout.children);
}

export function totalDuration(nodes: WorkoutNode[]): number {
  return flattenNodes(nodes).reduce((sum, s) => sum + s.duration, 0);
}
