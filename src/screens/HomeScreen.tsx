import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { CloseIcon, CopyIcon, DownloadIcon, EditIcon, MoreIcon, PlayIcon, PlusIcon, SettingsIcon, TrashIcon } from '../components/Icons';
import { flatten } from '../model/flatten';
import { formatClock, formatCountdown } from '../model/format';
import type { Workout } from '../model/types';
import { duplicateWorkout, newWorkout } from '../model/workout';
import { navigate } from '../hooks/useRoute';
import { downloadWorkout } from '../services/backup';
import { requestPersistentStorage, workoutsRepo } from '../services/db';
import { applyUpdate, promptInstall, useInstallAvailable, useUpdateReady } from '../services/pwa';
import { clearStoredRun, loadStoredRun } from '../store/run';
import { useSettings } from '../store/settings';

export function HomeScreen() {
  const workouts = useLiveQuery(() => workoutsRepo.list(), []);
  const [stored, setStored] = useState(loadStoredRun);
  const installAvailable = useInstallAvailable();
  const updateReady = useUpdateReady();

  const create = () => {
    const workout = newWorkout();
    // La séance est mise en cache immédiatement : l'éditeur n'attend pas l'écriture IndexedDB.
    void workoutsRepo.save(workout);
    void requestPersistentStorage();
    navigate(`/edit/${workout.id}`);
  };

  return (
    <div className="screen home">
      <header className="topbar">
        <h1>Timer</h1>
        <button type="button" className="icon-btn" onClick={() => navigate('/settings')} aria-label="Paramètres">
          <SettingsIcon />
        </button>
      </header>

      {updateReady && (
        <div className="banner">
          <span>Nouvelle version disponible.</span>
          <button type="button" className="btn small primary" onClick={applyUpdate}>
            Mettre à jour
          </button>
        </div>
      )}

      {installAvailable && (
        <div className="banner">
          <span>Installez l’app pour l’utiliser hors-ligne en plein écran.</span>
          <button type="button" className="btn small primary" onClick={() => void promptInstall()}>
            Installer
          </button>
        </div>
      )}

      {stored && (
        <div className="banner resume">
          <div>
            <strong>Séance en cours : {stored.workoutName}</strong>
            <small>
              Étape {stored.index + 1}/{stored.steps.length} · {stored.steps[stored.index].label} · {formatCountdown(stored.remainingMs)} restant
            </small>
          </div>
          <div className="banner-actions">
            <button type="button" className="btn small primary" onClick={() => navigate('/run')}>
              Reprendre
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Abandonner la séance en cours"
              onClick={() => {
                clearStoredRun();
                setStored(null);
              }}
            >
              <CloseIcon size={20} />
            </button>
          </div>
        </div>
      )}

      {workouts && workouts.length === 0 && (
        <div className="empty">
          <p>Aucune séance pour l’instant.</p>
          <p>Créez votre première séance : exercices, repos, blocs répétés jusqu’à 3 niveaux.</p>
        </div>
      )}

      <ul className="workout-list">
        {workouts?.map((w) => <WorkoutCard key={w.id} workout={w} />)}
      </ul>

      <footer className="bottom-bar">
        <button type="button" className="btn primary wide" onClick={create}>
          <PlusIcon size={20} /> Nouvelle séance
        </button>
      </footer>
    </div>
  );
}

function WorkoutCard({ workout }: { workout: Workout }) {
  const [open, setOpen] = useState(false);
  const skipLastRest = useSettings((s) => s.skipLastRest);
  const steps = flatten(workout, { skipLastRest });
  const total = steps.reduce((sum, s) => sum + s.duration, 0);
  const kinds = new Set(steps.map((s) => s.kind));

  return (
    <li className="workout-card">
      <div className="card-main">
        <button type="button" className="card-body" onClick={() => navigate(`/edit/${workout.id}`)}>
          <span className="card-title">{workout.name}</span>
          <span className="card-meta">
            {formatClock(total)} · {steps.length} étape{steps.length > 1 ? 's' : ''}
            <span className="kind-dots">
              {[...kinds].map((k) => (
                <i key={k} className={`dot kind-${k}`} />
              ))}
            </span>
          </span>
        </button>
        <button type="button" className="icon-btn" aria-label="Actions" aria-expanded={open} onClick={() => setOpen(!open)}>
          <MoreIcon />
        </button>
        <button
          type="button"
          className="play-btn"
          aria-label={`Lancer ${workout.name}`}
          disabled={steps.length === 0}
          onClick={() => navigate(`/run/${workout.id}`)}
        >
          <PlayIcon size={26} />
        </button>
      </div>
      {open && (
        <div className="card-actions">
          <button type="button" className="btn small" onClick={() => navigate(`/edit/${workout.id}`)}>
            <EditIcon size={18} /> Modifier
          </button>
          <button type="button" className="btn small" onClick={() => void workoutsRepo.save(duplicateWorkout(workout))}>
            <CopyIcon size={18} /> Dupliquer
          </button>
          <button type="button" className="btn small" onClick={() => downloadWorkout(workout)}>
            <DownloadIcon size={18} /> Exporter
          </button>
          <button
            type="button"
            className="btn small danger"
            onClick={() => {
              if (confirm(`Supprimer « ${workout.name} » ?`)) void workoutsRepo.remove(workout.id);
            }}
          >
            <TrashIcon size={18} /> Supprimer
          </button>
        </div>
      )}
    </li>
  );
}
