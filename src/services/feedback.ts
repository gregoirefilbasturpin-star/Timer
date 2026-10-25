/**
 * Traduit les événements du moteur en sons, annonces vocales et vibrations.
 * Point unique de couplage avec les API du navigateur : c'est ce module qu'il
 * faudrait remplacer pour passer à des modules natifs (Capacitor).
 */
import { stepAnnouncement } from '../engine/announce';
import type { Run, RunEvent } from '../engine/engine';
import { useSettings } from '../store/settings';
import { audio } from './audio';
import { vibrate } from './device';
import { estimateSpeechMs, speech } from './speech';

/** Au-delà, l'événement est un rattrapage (retour d'arrière-plan) : on reste silencieux. */
const MAX_LATENESS_MS = 1500;
/** Laisse le bip de départ se jouer avant la voix. */
const SPEECH_DELAY_MS = 350;

function announce(text: string, delayMs = 0): void {
  const s = useSettings.getState();
  if (!s.voice || !speech.supported) return;
  audio.holdFocus(estimateSpeechMs(text, s.voiceRate) + delayMs);
  speech.say(text, { voiceURI: s.voiceURI, rate: s.voiceRate, delayMs });
}

export const feedback = {
  /** À appeler dans un gestionnaire de clic (politique d'autoplay). */
  prime(): void {
    audio.prepare();
    speech.prime();
  },

  stop(): void {
    speech.cancel();
  },

  handle(events: RunEvent[], run: Run): void {
    const s = useSettings.getState();
    audio.volume = s.volume;
    let stepIndex: number | null = null;

    for (const event of events) {
      if (event.type === 'countdown') {
        if (s.beeps) audio.play('tick');
        if (s.vibration) vibrate(80);
      } else if (event.type === 'step') {
        if (event.late < MAX_LATENESS_MS) stepIndex = event.index;
      } else if (event.late < MAX_LATENESS_MS) {
        if (s.beeps) audio.play('finish');
        if (s.vibration) vibrate([200, 100, 200, 100, 400]);
        announce('Séance terminée. Bravo !', SPEECH_DELAY_MS);
        return;
      }
    }

    if (stepIndex === null) return;
    if (s.beeps) audio.play('go');
    if (s.vibration) vibrate(300);
    const text = stepAnnouncement(run.steps, stepIndex, {
      duration: s.announceDuration,
      next: s.announceNext,
      round: s.announceRound,
    });
    announce(text, s.beeps ? SPEECH_DELAY_MS : 0);
  },

  test(): void {
    feedback.prime();
    const s = useSettings.getState();
    audio.volume = s.volume;
    if (s.beeps) audio.play('go');
    announce('Pompes, 30 secondes', s.beeps ? SPEECH_DELAY_MS : 0);
  },
};
