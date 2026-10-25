import type { FlatStep } from '../model/flatten';

export interface AnnounceOptions {
  duration: boolean;
  next: boolean;
  round: boolean;
}

export function spokenDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const minutes = m === 1 ? '1 minute' : `${m} minutes`;
  const secs = s === 1 ? '1 seconde' : `${s} secondes`;
  if (m && s) return `${minutes} ${s}`;
  return m ? minutes : secs;
}

const spokenLoad = (step: FlatStep) => (step.load ? `charge ${step.load}` : null);

/** Texte prononcé au début d'une étape : « Squats, 30 secondes, charge 20 kg ». */
export function stepAnnouncement(steps: FlatStep[], index: number, options: AnnounceOptions): string {
  const step = steps[index];
  const head = [step.label];
  const round = step.rounds.at(-1);
  if (options.round && round && !step.betweenRounds) head.push(`${round.label} ${round.current} sur ${round.total}`);
  if (options.duration) head.push(spokenDuration(step.duration));
  const load = spokenLoad(step);
  if (load) head.push(load);

  let text = head.join(', ');
  const following = steps[index + 1];
  if (options.next && following && (step.kind === 'rest' || step.kind === 'prep')) {
    text += `. Ensuite, ${[following.label, spokenLoad(following)].filter(Boolean).join(', ')}`;
  }
  return text;
}
