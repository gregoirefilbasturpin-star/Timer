import { describe, expect, it } from 'vitest';
import { appendNode, duplicateNode, moveNode, newBlock, newStep, removeNode, sanitizeWorkout, updateNode } from './workout';

describe('opérations sur l’arbre', () => {
  it('modifie, déplace, duplique et supprime un nœud imbriqué', () => {
    const block = newBlock();
    const [work, rest] = block.children;
    let list = [newStep('prep'), block];

    list = updateNode(list, work.id, { name: 'Pompes' });
    list = moveNode(list, rest.id, -1);
    list = duplicateNode(list, rest.id);
    const children = (list[1] as typeof block).children;
    expect(children.map((n) => (n.type === 'step' ? n.kind : n.type))).toEqual(['rest', 'rest', 'work']);
    expect(children[0].id).not.toBe(children[1].id);

    list = removeNode(list, work.id);
    expect((list[1] as typeof block).children).toHaveLength(2);
  });

  it('ajoute un enfant à un bloc ou à la racine', () => {
    const block = newBlock();
    let list = appendNode([block], block.id, newStep('stretch'));
    list = appendNode(list, null, newStep('rest'));
    expect((list[0] as typeof block).children).toHaveLength(3);
    expect(list).toHaveLength(2);
  });
});

describe('sanitizeWorkout', () => {
  it('normalise une séance importée', () => {
    const w = sanitizeWorkout({ name: ' Jambes ', children: [{ type: 'step', kind: 'work', name: 'Squats', duration: 30.4 }] });
    expect(w?.name).toBe('Jambes');
    expect(w?.children[0]).toMatchObject({ kind: 'work', duration: 30 });
  });

  it('refuse plus de trois niveaux de blocs ou un type inconnu', () => {
    const deep = (d: number): unknown => (d === 0 ? { type: 'step', kind: 'work', duration: 5 } : { type: 'block', rounds: 2, children: [deep(d - 1)] });
    expect(sanitizeWorkout({ children: [deep(3)] })).not.toBeNull();
    expect(sanitizeWorkout({ children: [deep(4)] })).toBeNull();
    expect(sanitizeWorkout({ children: [{ type: 'step', kind: 'sprint', duration: 5 }] })).toBeNull();
  });
});
