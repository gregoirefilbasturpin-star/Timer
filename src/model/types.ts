export type StepKind = 'work' | 'rest' | 'prep' | 'stretch';

export interface StepNode {
  id: string;
  type: 'step';
  kind: StepKind;
  /** Ignoré pour « repos » et « préparation ». */
  name: string;
  /** Secondes. */
  duration: number;
  description?: string;
  load?: string;
}

export interface BlockNode {
  id: string;
  type: 'block';
  name: string;
  rounds: number;
  /** Secondes, 0 = aucun repos inséré entre les tours. */
  restBetweenRounds: number;
  /** Au dernier tour, supprime le repos final du bloc. */
  skipLastRest: boolean;
  children: WorkoutNode[];
}

export type WorkoutNode = StepNode | BlockNode;

export interface Workout {
  id: string;
  name: string;
  children: WorkoutNode[];
  createdAt: number;
  updatedAt: number;
}

export const STEP_KINDS: StepKind[] = ['work', 'rest', 'prep', 'stretch'];

export const KIND_LABELS: Record<StepKind, string> = {
  work: 'Travail',
  rest: 'Repos',
  prep: 'Préparation',
  stretch: 'Étirement',
};

/** Types d'étape qui portent un nom saisi par l'utilisateur. */
export const NAMED_KINDS: ReadonlySet<StepKind> = new Set(['work', 'stretch']);

export const MAX_BLOCK_DEPTH = 3;
export const MAX_DURATION = 99 * 60 + 59;
export const MAX_ROUNDS = 99;
