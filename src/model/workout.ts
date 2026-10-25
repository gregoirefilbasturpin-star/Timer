import {
  MAX_BLOCK_DEPTH,
  MAX_DURATION,
  MAX_ROUNDS,
  STEP_KINDS,
  type BlockNode,
  type StepKind,
  type StepNode,
  type Workout,
  type WorkoutNode,
} from './types';

export const uid = (): string => crypto.randomUUID();

const DEFAULT_DURATIONS: Record<StepKind, number> = { work: 30, rest: 15, prep: 10, stretch: 30 };

export function newStep(kind: StepKind = 'work'): StepNode {
  return { id: uid(), type: 'step', kind, name: '', duration: DEFAULT_DURATIONS[kind] };
}

export function newBlock(): BlockNode {
  return {
    id: uid(),
    type: 'block',
    name: '',
    rounds: 3,
    restBetweenRounds: 0,
    children: [newStep('work'), newStep('rest')],
  };
}

export function newWorkout(): Workout {
  const now = Date.now();
  return {
    id: uid(),
    name: 'Nouvelle séance',
    children: [newStep('prep'), newStep('work')],
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneNode(node: WorkoutNode): WorkoutNode {
  if (node.type === 'step') return { ...node, id: uid() };
  return { ...node, id: uid(), children: node.children.map(cloneNode) };
}

export function duplicateWorkout(workout: Workout): Workout {
  const now = Date.now();
  return {
    ...workout,
    id: uid(),
    name: `${workout.name} (copie)`,
    children: workout.children.map(cloneNode),
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Opérations immuables sur l'arbre

type NodeList = WorkoutNode[];

/** Applique `fn` à la liste (racine ou enfants d'un bloc) qui contient le nœud `id`. */
function editContainingList(list: NodeList, id: string, fn: (list: NodeList, index: number) => NodeList): NodeList {
  const index = list.findIndex((n) => n.id === id);
  if (index >= 0) return fn(list, index);
  let changed = false;
  const next = list.map((node) => {
    if (node.type !== 'block') return node;
    const children = editContainingList(node.children, id, fn);
    if (children === node.children) return node;
    changed = true;
    return { ...node, children };
  });
  return changed ? next : list;
}

export function updateNode(list: NodeList, id: string, patch: Partial<StepNode> | Partial<BlockNode>): NodeList {
  return editContainingList(list, id, (l, i) => l.map((n, j) => (j === i ? ({ ...n, ...patch } as WorkoutNode) : n)));
}

export function removeNode(list: NodeList, id: string): NodeList {
  return editContainingList(list, id, (l, i) => l.filter((_, j) => j !== i));
}

export function moveNode(list: NodeList, id: string, delta: -1 | 1): NodeList {
  return editContainingList(list, id, (l, i) => {
    const j = i + delta;
    if (j < 0 || j >= l.length) return l;
    const copy = [...l];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });
}

export function duplicateNode(list: NodeList, id: string): NodeList {
  return editContainingList(list, id, (l, i) => [...l.slice(0, i + 1), cloneNode(l[i]), ...l.slice(i + 1)]);
}

export function appendNode(list: NodeList, parentId: string | null, node: WorkoutNode): NodeList {
  if (parentId === null) return [...list, node];
  return editContainingList(list, parentId, (l, i) =>
    l.map((n, j) => (j === i && n.type === 'block' ? { ...n, children: [...n.children, node] } : n)),
  );
}

// ---------------------------------------------------------------------------
// Validation des fichiers importés

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const asString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function asInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeNodes(list: unknown[], depth: number): WorkoutNode[] | null {
  const out: WorkoutNode[] = [];
  for (const raw of list) {
    if (!isObject(raw)) return null;
    if (raw.type === 'step') {
      const kind = raw.kind as StepKind;
      if (!STEP_KINDS.includes(kind)) return null;
      const step: StepNode = {
        id: asString(raw.id) || uid(),
        type: 'step',
        kind,
        name: asString(raw.name),
        duration: asInt(raw.duration, 1, MAX_DURATION, DEFAULT_DURATIONS[kind]),
      };
      const description = asString(raw.description);
      const load = asString(raw.load);
      if (description) step.description = description;
      if (load) step.load = load;
      out.push(step);
    } else if (raw.type === 'block') {
      if (depth >= MAX_BLOCK_DEPTH || !Array.isArray(raw.children)) return null;
      const children = sanitizeNodes(raw.children, depth + 1);
      if (!children) return null;
      out.push({
        id: asString(raw.id) || uid(),
        type: 'block',
        name: asString(raw.name),
        rounds: asInt(raw.rounds, 1, MAX_ROUNDS, 1),
        restBetweenRounds: asInt(raw.restBetweenRounds, 0, MAX_DURATION, 0),
        children,
      });
    } else {
      return null;
    }
  }
  return out;
}

/** Retourne une séance valide ou `null` si la structure est inexploitable. */
export function sanitizeWorkout(raw: unknown): Workout | null {
  if (!isObject(raw) || !Array.isArray(raw.children)) return null;
  const children = sanitizeNodes(raw.children, 0);
  if (!children) return null;
  const now = Date.now();
  return {
    id: asString(raw.id) || uid(),
    name: asString(raw.name) || 'Séance importée',
    children,
    createdAt: asInt(raw.createdAt, 0, Number.MAX_SAFE_INTEGER, now),
    updatedAt: asInt(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER, now),
  };
}
