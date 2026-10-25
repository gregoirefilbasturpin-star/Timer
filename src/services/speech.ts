/**
 * Synthèse vocale via l'API Web Speech. Sur Android, Chrome s'appuie sur le
 * moteur du système : hors-ligne, il faut qu'une voix française soit
 * téléchargée (Paramètres › Synthèse vocale › Moteur Google).
 */

type Listener = () => void;

export interface SayOptions {
  voiceURI: string | null;
  rate: number;
  delayMs?: number;
}

class SpeechService {
  readonly supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  private voices: SpeechSynthesisVoice[] = [];
  private listeners = new Set<Listener>();
  private pending: number | undefined;

  constructor() {
    if (!this.supported) return;
    const load = () => {
      this.voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'));
      this.listeners.forEach((l) => l());
    };
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private pick(voiceURI: string | null): SpeechSynthesisVoice | undefined {
    return (
      this.voices.find((v) => v.voiceURI === voiceURI) ??
      this.voices.find((v) => v.lang === 'fr-FR' && v.localService) ??
      this.voices.find((v) => v.lang === 'fr-FR') ??
      this.voices[0]
    );
  }

  /** Débloque la synthèse : Chrome exige un premier appel lors d'un geste utilisateur. */
  prime(): void {
    if (!this.supported) return;
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    speechSynthesis.speak(u);
  }

  say(text: string, { voiceURI, rate, delayMs = 0 }: SayOptions): void {
    if (!this.supported) return;
    this.cancel();
    const speak = () => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      u.rate = rate;
      const voice = this.pick(voiceURI);
      if (voice) u.voice = voice;
      speechSynthesis.speak(u);
    };
    if (delayMs > 0) this.pending = window.setTimeout(speak, delayMs);
    else speak();
  }

  cancel(): void {
    if (!this.supported) return;
    window.clearTimeout(this.pending);
    speechSynthesis.cancel();
  }
}

export const speech = new SpeechService();

/** Estimation grossière de la durée d'une annonce, pour maintenir l'atténuation audio. */
export function estimateSpeechMs(text: string, rate: number): number {
  return 500 + (text.length * 75) / rate;
}
