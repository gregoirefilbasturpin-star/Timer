import { sanitizeWorkout } from '../model/workout';
import type { Workout } from '../model/types';
import { pickSettings, useSettings, type Settings } from '../store/settings';
import { workoutsRepo } from './db';

interface BackupFile {
  app: 'timer';
  version: 1;
  exportedAt: string;
  workouts: Workout[];
  settings?: Settings;
}

const today = () => new Date().toISOString().slice(0, 10);

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'seance';

function toFile(data: BackupFile, filename: string): File {
  return new File([JSON.stringify(data, null, 2)], filename, { type: 'application/json' });
}

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fullBackup(): Promise<File> {
  const data: BackupFile = {
    app: 'timer',
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts: await workoutsRepo.list(),
    settings: pickSettings(useSettings.getState()),
  };
  return toFile(data, `timer-sauvegarde-${today()}.json`);
}

export async function downloadBackup(): Promise<void> {
  download(await fullBackup());
}

export function canShareFiles(): boolean {
  try {
    return !!navigator.canShare?.({ files: [new File(['{}'], 'test.json', { type: 'application/json' })] });
  } catch {
    return false;
  }
}

/** Ouvre la feuille de partage Android (Drive, mail…). */
export async function shareBackup(): Promise<void> {
  const file = await fullBackup();
  try {
    await navigator.share({ files: [file], title: 'Sauvegarde Timer' });
  } catch (e) {
    if ((e as DOMException).name !== 'AbortError') throw e;
  }
}

export function downloadWorkout(workout: Workout): void {
  download(toFile({ app: 'timer', version: 1, exportedAt: new Date().toISOString(), workouts: [workout] }, `seance-${slug(workout.name)}.json`));
}

export interface ImportResult {
  workouts: number;
  settings: boolean;
}

/**
 * Importe une sauvegarde complète ou une séance exportée.
 * Une séance de même identifiant est remplacée, les autres sont ajoutées.
 */
export async function importFile(file: File): Promise<ImportResult> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Fichier illisible : ce n’est pas un JSON valide.');
  }
  const rawList = Array.isArray(data) ? data : (data as Partial<BackupFile>)?.workouts ?? [data];
  const workouts = (Array.isArray(rawList) ? rawList : []).map(sanitizeWorkout).filter((w): w is Workout => w !== null);
  const rawSettings = !Array.isArray(data) ? (data as Partial<BackupFile>)?.settings : undefined;

  if (!workouts.length && !rawSettings) throw new Error('Aucune séance valide dans ce fichier.');
  if (workouts.length) await workoutsRepo.saveMany(workouts);
  if (rawSettings && typeof rawSettings === 'object') useSettings.getState().update(pickSettings(rawSettings));
  return { workouts: workouts.length, settings: !!rawSettings };
}
