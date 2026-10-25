import { createContext, useContext, useState } from 'react';
import { totalDuration } from '../model/flatten';
import { formatClock } from '../model/format';
import { KIND_LABELS, MAX_BLOCK_DEPTH, MAX_ROUNDS, NAMED_KINDS, STEP_KINDS, type BlockNode, type StepKind, type StepNode, type WorkoutNode } from '../model/types';
import { newBlock, newStep } from '../model/workout';
import { DurationInput, Stepper, Toggle } from './inputs';
import { ChevronIcon, CopyIcon, DownIcon, MoreIcon, TrashIcon, UpIcon } from './Icons';

export interface EditorActions {
  patch: (id: string, patch: Partial<StepNode> | Partial<BlockNode>) => void;
  remove: (id: string) => void;
  move: (id: string, delta: -1 | 1) => void;
  duplicate: (id: string) => void;
  add: (parentId: string | null, node: WorkoutNode) => void;
}

export const EditorContext = createContext<EditorActions | null>(null);

function useActions(): EditorActions {
  const actions = useContext(EditorContext);
  if (!actions) throw new Error('EditorContext manquant');
  return actions;
}

interface NodeListProps {
  nodes: WorkoutNode[];
  /** Nombre de blocs englobants (0 = racine). */
  depth: number;
  parentId: string | null;
}

export function NodeList({ nodes, depth, parentId }: NodeListProps) {
  return (
    <div className="node-list">
      {nodes.map((node, i) =>
        node.type === 'step' ? (
          <StepEditor key={node.id} step={node} first={i === 0} last={i === nodes.length - 1} />
        ) : (
          <BlockEditor key={node.id} block={node} depth={depth + 1} first={i === 0} last={i === nodes.length - 1} />
        ),
      )}
      <AddBar parentId={parentId} canAddBlock={depth < MAX_BLOCK_DEPTH} />
    </div>
  );
}

function AddBar({ parentId, canAddBlock }: { parentId: string | null; canAddBlock: boolean }) {
  const { add } = useActions();
  const kinds: StepKind[] = ['work', 'rest', 'stretch', 'prep'];
  return (
    <div className="add-bar">
      {kinds.map((kind) => (
        <button key={kind} type="button" className={`chip kind-${kind}`} onClick={() => add(parentId, newStep(kind))}>
          + {KIND_LABELS[kind]}
        </button>
      ))}
      {canAddBlock && (
        <button type="button" className="chip chip-block" onClick={() => add(parentId, newBlock())}>
          + Bloc
        </button>
      )}
    </div>
  );
}

function NodeMenu({ id, first, last }: { id: string; first: boolean; last: boolean }) {
  const { move, duplicate, remove } = useActions();
  return (
    <div className="node-menu">
      <button type="button" className="icon-btn" disabled={first} onClick={() => move(id, -1)} aria-label="Monter">
        <UpIcon size={20} />
      </button>
      <button type="button" className="icon-btn" disabled={last} onClick={() => move(id, 1)} aria-label="Descendre">
        <DownIcon size={20} />
      </button>
      <button type="button" className="icon-btn" onClick={() => duplicate(id)} aria-label="Dupliquer">
        <CopyIcon size={20} />
      </button>
      <button type="button" className="icon-btn danger" onClick={() => remove(id)} aria-label="Supprimer">
        <TrashIcon size={20} />
      </button>
    </div>
  );
}

function StepEditor({ step, first, last }: { step: StepNode; first: boolean; last: boolean }) {
  const { patch } = useActions();
  const [open, setOpen] = useState(false);
  const named = NAMED_KINDS.has(step.kind);
  const extras = [step.load, step.description].filter(Boolean).join(' · ');

  return (
    <div className={`node step kind-${step.kind}`}>
      <div className="step-row">
        <select
          className="kind-select"
          value={step.kind}
          aria-label="Type d'étape"
          onChange={(e) => patch(step.id, { kind: e.target.value as StepKind })}
        >
          {STEP_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        {named ? (
          <input
            className="name-input"
            value={step.name}
            placeholder={step.kind === 'work' ? "Nom de l'exercice" : "Nom de l'étirement"}
            onChange={(e) => patch(step.id, { name: e.target.value })}
          />
        ) : (
          <span className="name-placeholder" />
        )}
      </div>
      <div className="step-row">
        <DurationInput value={step.duration} onChange={(duration) => patch(step.id, { duration })} />
        <button type="button" className="icon-btn" aria-expanded={open} aria-label="Plus d'options" onClick={() => setOpen(!open)}>
          <MoreIcon size={20} />
        </button>
      </div>
      {!open && extras && <p className="step-extras">{extras}</p>}
      {open && (
        <div className="node-panel">
          {named && (
            <>
              <input
                value={step.load ?? ''}
                placeholder="Charge (optionnel) : 20 kg, élastique rouge…"
                onChange={(e) => patch(step.id, { load: e.target.value })}
              />
              <textarea
                rows={2}
                value={step.description ?? ''}
                placeholder="Description (optionnel)"
                onChange={(e) => patch(step.id, { description: e.target.value })}
              />
            </>
          )}
          <NodeMenu id={step.id} first={first} last={last} />
        </div>
      )}
    </div>
  );
}

function BlockEditor({ block, depth, first, last }: { block: BlockNode; depth: number; first: boolean; last: boolean }) {
  const { patch } = useActions();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const total = totalDuration([block]);
  const summary = [
    `${block.rounds} tour${block.rounds > 1 ? 's' : ''}`,
    block.restBetweenRounds > 0 ? `repos ${formatClock(block.restBetweenRounds)} entre tours` : null,
    `total ${formatClock(total)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`node block depth-${depth}`}>
      <div className="block-head">
        <button
          type="button"
          className={`icon-btn collapse${collapsed ? ' collapsed' : ''}`}
          aria-label={collapsed ? 'Déplier' : 'Replier'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronIcon size={20} />
        </button>
        <input className="name-input" value={block.name} placeholder="Nom du bloc (ex. Circuit)" onChange={(e) => patch(block.id, { name: e.target.value })} />
        <button type="button" className="icon-btn" aria-expanded={open} aria-label="Options du bloc" onClick={() => setOpen(!open)}>
          <MoreIcon size={20} />
        </button>
      </div>
      <div className="block-row">
        <span className="field-label">Tours</span>
        <Stepper value={block.rounds} min={1} max={MAX_ROUNDS} label="Tours" onChange={(rounds) => patch(block.id, { rounds })} />
      </div>
      <p className="block-summary">{summary}</p>
      {open && (
        <div className="node-panel">
          <div className="block-row">
            <span className="field-label">Repos entre les tours</span>
            <DurationInput value={block.restBetweenRounds} min={0} onChange={(restBetweenRounds) => patch(block.id, { restBetweenRounds })} />
          </div>
          <Toggle checked={block.skipLastRest} onChange={(skipLastRest) => patch(block.id, { skipLastRest })} hint="Au dernier tour, le repos final du bloc est supprimé.">
            Sauter le dernier repos
          </Toggle>
          <NodeMenu id={block.id} first={first} last={last} />
        </div>
      )}
      {!collapsed && <NodeList nodes={block.children} depth={depth} parentId={block.id} />}
    </div>
  );
}
