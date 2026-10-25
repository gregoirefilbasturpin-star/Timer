import Dexie, { type EntityTable } from 'dexie';
import type { Workout } from '../model/types';

export const db = new Dexie('timer') as Dexie & { workouts: EntityTable<Workout, 'id'> };

db.version(1).stores({ workouts: 'id, updatedAt' });

export const workoutsRepo = {
  async list(): Promise<Workout[]> {
    const all = await db.workouts.toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  },
  get: (id: string) => db.workouts.get(id),
  save: (workout: Workout) => db.workouts.put({ ...workout, updatedAt: Date.now() }),
  saveMany: (workouts: Workout[]) => db.workouts.bulkPut(workouts),
  remove: (id: string) => db.workouts.delete(id),
};

/** Demande au navigateur de ne jamais purger les données de l'app. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

export async function isStoragePersistent(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}
