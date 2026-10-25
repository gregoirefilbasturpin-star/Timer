import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Settings {
  voice: boolean;
  voiceURI: string | null;
  voiceRate: number;
  announceDuration: boolean;
  announceNext: boolean;
  announceRound: boolean;
  beeps: boolean;
  volume: number;
  vibration: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  voice: true,
  voiceURI: null,
  voiceRate: 1.05,
  announceDuration: true,
  announceNext: true,
  announceRound: false,
  beeps: true,
  volume: 1,
  vibration: true,
};

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsStore>()(
  persist((set) => ({ ...DEFAULT_SETTINGS, update: (patch) => set(patch) }), {
    name: 'timer.settings',
    partialize: (state) => pickSettings(state),
  }),
);

export function pickSettings(source: Partial<Settings>): Settings {
  const out = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = source[key];
    if (value !== undefined && (typeof value === typeof DEFAULT_SETTINGS[key] || key === 'voiceURI')) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}
