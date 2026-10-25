/**
 * Sons générés à la volée en WAV et joués par des éléments <audio>.
 *
 * Choix délibéré plutôt que Web Audio : sur Chrome Android, un média court
 * (< 5 s) lu par un élément <audio> demande au système un focus audio
 * « transitoire avec atténuation », ce qui baisse temporairement la musique
 * des autres apps. Comportement non garanti, dépend de la version d'Android.
 */

export type SoundName = 'tick' | 'go' | 'finish';

const RATE = 22050;
/** Durée max du clip silencieux qui maintient l'atténuation pendant une annonce. */
const HOLD_MAX_MS = 4500;

interface Tone {
  freq: number;
  start: number;
  dur: number;
  gain?: number;
}

function render(tones: Tone[], totalSec: number): Float32Array {
  const out = new Float32Array(Math.ceil(totalSec * RATE));
  for (const tone of tones) {
    const s0 = Math.floor(tone.start * RATE);
    const n = Math.floor(tone.dur * RATE);
    const gain = tone.gain ?? 0.6;
    const attack = Math.max(1, Math.floor(0.005 * RATE));
    const release = Math.max(1, Math.floor(0.04 * RATE));
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const env = Math.min(1, i / attack, (n - i) / release);
      out[s0 + i] += gain * env * Math.sin((2 * Math.PI * tone.freq * i) / RATE);
    }
  }
  return out;
}

function toWav(samples: Float32Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return new Blob([buffer], { type: 'audio/wav' });
}

const SOUNDS: Record<SoundName | 'hold', () => Float32Array> = {
  tick: () => render([{ freq: 880, start: 0, dur: 0.12 }], 0.15),
  go: () =>
    render(
      [
        { freq: 1046, start: 0, dur: 0.12 },
        { freq: 1568, start: 0.1, dur: 0.35 },
      ],
      0.5,
    ),
  finish: () =>
    render(
      [
        { freq: 784, start: 0, dur: 0.16 },
        { freq: 988, start: 0.16, dur: 0.16 },
        { freq: 1319, start: 0.32, dur: 0.6 },
      ],
      1,
    ),
  // Signal inaudible (≈ -80 dB) : un silence parfait pourrait être ignoré par le système.
  hold: () => render([{ freq: 200, start: 0, dur: HOLD_MAX_MS / 1000, gain: 0.0001 }], HOLD_MAX_MS / 1000),
};

class AudioService {
  private elements = new Map<SoundName | 'hold', HTMLAudioElement>();
  private holdTimer: number | undefined;
  volume = 1;

  /** Crée les éléments audio. À appeler lors d'un geste utilisateur. */
  prepare(): void {
    if (this.elements.size) return;
    for (const [name, build] of Object.entries(SOUNDS) as [SoundName | 'hold', () => Float32Array][]) {
      const el = new Audio(URL.createObjectURL(toWav(build())));
      el.preload = 'auto';
      this.elements.set(name, el);
    }
  }

  play(name: SoundName): void {
    this.prepare();
    const el = this.elements.get(name)!;
    el.volume = this.volume;
    el.currentTime = 0;
    void el.play().catch(() => {});
  }

  /** Maintient l'atténuation de la musique externe pendant `ms` (annonce vocale). */
  holdFocus(ms: number): void {
    this.prepare();
    const el = this.elements.get('hold')!;
    window.clearTimeout(this.holdTimer);
    el.currentTime = 0;
    void el.play().catch(() => {});
    this.holdTimer = window.setTimeout(() => el.pause(), Math.min(ms, HOLD_MAX_MS));
  }
}

export const audio = new AudioService();
