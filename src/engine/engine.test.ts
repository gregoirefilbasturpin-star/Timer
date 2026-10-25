import { describe, expect, it } from 'vitest';
import { flattenNodes } from '../model/flatten';
import type { StepNode } from '../model/types';
import { stepAnnouncement, spokenDuration } from './announce';
import { addTime, createRunFromSteps, next, pause, previous, progress, remainingMs, resume, start, tick, toStored, type Run } from './engine';

const step = (kind: StepNode['kind'], duration: number, name = ''): StepNode => ({ id: name + duration, type: 'step', kind, name, duration });
const steps = flattenNodes([step('prep', 5), step('work', 10, 'Squats'), step('rest', 5)], { skipLastRest: false });
const T0 = 1_000_000;

function started(): Run {
  return start(createRunFromSteps('w', 'Test', steps)!, T0).run;
}

describe('engine', () => {
  it('annonce la première étape au démarrage', () => {
    const t = start(createRunFromSteps('w', 'Test', steps)!, T0);
    expect(t.events).toEqual([{ type: 'step', index: 0, late: 0 }]);
    expect(t.run.endsAt).toBe(T0 + 5000);
  });

  it('enchaîne les étapes sans dérive', () => {
    const t = tick(started(), T0 + 5050);
    expect(t.run.index).toBe(1);
    expect(t.run.endsAt).toBe(T0 + 15000);
    expect(t.events[0]).toEqual({ type: 'step', index: 1, late: 50 });
  });

  it('émet le décompte 3-2-1 une seule fois par seconde', () => {
    let run = tick(started(), T0 + 5000).run; // étape 2, 10 s
    const values: number[] = [];
    for (let t = T0 + 5000; t < T0 + 15000; t += 100) {
      const res = tick(run, t);
      run = res.run;
      res.events.forEach((e) => e.type === 'countdown' && values.push(e.value));
    }
    expect(values).toEqual([3, 2, 1]);
  });

  it('rattrape plusieurs étapes après une mise en arrière-plan', () => {
    const t = tick(started(), T0 + 30_000);
    expect(t.run.status).toBe('finished');
    expect(t.events.map((e) => e.type)).toEqual(['step', 'step', 'finished']);
  });

  it('met en pause et reprend avec le temps restant', () => {
    const paused = pause(started(), T0 + 2000).run;
    expect(paused.remainingMs).toBe(3000);
    const resumed = resume(paused, T0 + 60_000).run;
    expect(remainingMs(resumed, T0 + 60_000)).toBe(3000);
  });

  it('précédent relance l’étape si plus de 3 s écoulées, sinon recule', () => {
    const run = tick(started(), T0 + 5000).run;
    expect(previous(run, T0 + 6000).run.index).toBe(0);
    expect(previous(run, T0 + 9000).run.index).toBe(1);
  });

  it('suivant sur la dernière étape termine la séance', () => {
    let run = started();
    run = next(run, T0).run;
    run = next(run, T0).run;
    const t = next(run, T0);
    expect(t.run.status).toBe('finished');
    expect(t.events).toEqual([{ type: 'finished', late: 0 }]);
  });

  it('ajoute du temps à l’étape courante', () => {
    const run = addTime(started(), T0 + 1000, 10_000).run;
    expect(remainingMs(run, T0 + 1000)).toBe(14_000);
    expect(run.stepTotalMs).toBe(15_000);
  });

  it('calcule la progression globale', () => {
    const run = tick(started(), T0 + 10_000).run; // milieu de l'étape 2
    const p = progress(run, T0 + 10_000);
    expect(p.ratio).toBeCloseTo(0.5);
    expect(p.remainingTotalMs).toBe(10_000);
  });

  it('sauvegarde une séance en cours comme une pause', () => {
    const stored = toStored(started(), T0 + 1000);
    expect(stored.status).toBe('paused');
    expect(stored.remainingMs).toBe(4000);
  });
});

describe('announce', () => {
  it('formule les durées en français', () => {
    expect(spokenDuration(30)).toBe('30 secondes');
    expect(spokenDuration(60)).toBe('1 minute');
    expect(spokenDuration(90)).toBe('1 minute 30');
    expect(spokenDuration(120)).toBe('2 minutes');
  });

  it("annonce l'exercice suivant pendant la préparation", () => {
    const opts = { duration: true, next: true, round: false };
    expect(stepAnnouncement(steps, 0, opts)).toBe('Préparation, 5 secondes. Ensuite, Squats');
    expect(stepAnnouncement(steps, 1, opts)).toBe('Squats, 10 secondes');
  });

  it('annonce la charge seulement si elle est renseignée', () => {
    const loaded = flattenNodes([step('prep', 5), { ...step('work', 30, 'Squats'), load: '20 kg' }], { skipLastRest: false });
    const opts = { duration: true, next: true, round: false };
    expect(stepAnnouncement(loaded, 1, opts)).toBe('Squats, 30 secondes, charge 20 kg');
    expect(stepAnnouncement(loaded, 0, opts)).toBe('Préparation, 5 secondes. Ensuite, Squats, charge 20 kg');
  });
});
