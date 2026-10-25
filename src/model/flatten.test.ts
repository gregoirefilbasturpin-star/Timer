import { describe, expect, it } from 'vitest';
import { flattenNodes as flattenWith, totalDuration, type FlattenOptions } from './flatten';
import type { BlockNode, StepKind, StepNode, WorkoutNode } from './types';

const step = (kind: StepKind, duration: number, name = ''): StepNode => ({ id: `${kind}${duration}${name}`, type: 'step', kind, name, duration });
const block = (rounds: number, children: WorkoutNode[], extra: Partial<BlockNode> = {}): BlockNode => ({
  id: `b${rounds}`,
  type: 'block',
  name: '',
  rounds,
  restBetweenRounds: 0,
  children,
  ...extra,
});

const KEEP: FlattenOptions = { skipLastRest: false };
const flattenNodes = (nodes: WorkoutNode[], options = KEEP) => flattenWith(nodes, options);

describe('flattenNodes', () => {
  it('déroule les répétitions et calcule les offsets', () => {
    const steps = flattenNodes([step('prep', 10), block(2, [step('work', 30, 'Pompes'), step('rest', 15)])]);
    expect(steps.map((s) => [s.label, s.offset])).toEqual([
      ['Préparation', 0],
      ['Pompes', 10],
      ['Repos', 40],
      ['Pompes', 55],
      ['Repos', 85],
    ]);
    expect(steps[3].rounds).toEqual([{ label: 'Tour', current: 2, total: 2 }]);
  });

  it('garde le dernier repos si l’option est désactivée', () => {
    const steps = flattenNodes([block(2, [step('work', 30), step('rest', 15)])]);
    expect(steps.map((s) => s.kind)).toEqual(['work', 'rest', 'work', 'rest']);
  });

  it('saute le dernier repos du dernier tour', () => {
    const steps = flattenNodes([block(2, [step('work', 30), step('rest', 15)])], { skipLastRest: true });
    expect(steps.map((s) => s.kind)).toEqual(['work', 'rest', 'work']);
  });

  it('insère le repos entre les tours, sauf après le dernier', () => {
    const steps = flattenNodes([block(3, [step('work', 20)], { restBetweenRounds: 60, name: 'Circuit' })]);
    expect(steps.map((s) => s.kind)).toEqual(['work', 'rest', 'work', 'rest', 'work']);
    expect(steps[1].betweenRounds).toBe(true);
    expect(steps[4].rounds[0].label).toBe('Circuit');
  });

  it('gère trois niveaux imbriqués', () => {
    const inner = block(2, [step('work', 5)]);
    const middle = block(2, [inner]);
    const outer = block(2, [middle]);
    const steps = flattenNodes([outer]);
    expect(steps).toHaveLength(8);
    expect(steps[7].rounds.map((r) => r.current)).toEqual([2, 2, 2]);
    expect(totalDuration([outer], KEEP)).toBe(40);
  });

  it('ignore les tours uniques dans le suivi des tours', () => {
    const steps = flattenNodes([block(1, [step('work', 5)])]);
    expect(steps[0].rounds).toEqual([]);
  });

  it("utilise le type comme libellé pour repos, préparation ou nom vide", () => {
    const steps = flattenNodes([step('rest', 5, 'ignoré'), step('stretch', 5, 'Ischios'), step('work', 5)]);
    expect(steps.map((s) => s.label)).toEqual(['Repos', 'Ischios', 'Travail']);
  });
});
