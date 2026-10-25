import Dexie, { type EntityTable } from 'dexie';
import type { Workout } from '../model/types';

export const db = new Dexie('timer') as Dexie & { workouts: EntityTable<Workout, 'id'> };

db.version(1).stores({ workouts: 'id, updatedAt' });

/**
 * Copie mémoire des séances lues ou écrites : l'éditeur et l'écran de séance
 * s'affichent immédiatement sans attendre IndexedDB.
 */
const cache = new Map<string, Workout>();

export const workoutsRepo = {
  async list(): Promise<Workout[]> {
    const all = await db.workouts.toArray();
    all.forEach((w) => cache.set(w.id, w));
    return all.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  },
  peek: (id: string): Workout | undefined => cache.get(id),
  async get(id: string): Promise<Workout | undefined> {
    const workout = cache.get(id) ?? (await db.workouts.get(id));
    if (workout) cache.set(id, workout);
    return workout;
  },
  async save(workout: Workout): Promise<void> {
    const saved = { ...workout, updatedAt: Date.now() };
    cache.set(saved.id, saved);
    await db.workouts.put(saved);
  },
  async saveMany(workouts: Workout[]): Promise<void> {
    workouts.forEach((w) => cache.set(w.id, w));
    await db.workouts.bulkPut(workouts);
  },
  async remove(id: string): Promise<void> {
    cache.delete(id);
    await db.workouts.delete(id);
  },
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
