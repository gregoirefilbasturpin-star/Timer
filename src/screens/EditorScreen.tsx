import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackIcon, PlayIcon } from '../components/Icons';
import { EditorContext, NodeList, type EditorActions } from '../components/NodeEditor';
import { totalDuration } from '../model/flatten';
import { formatClock } from '../model/format';
import type { Workout } from '../model/types';
import { appendNode, duplicateNode, moveNode, removeNode, updateNode } from '../model/workout';
import { goBack, navigate } from '../hooks/useRoute';
import { workoutsRepo } from '../services/db';
import { MessageScreen } from '../components/MessageScreen';
import { useSettings } from '../store/settings';

const AUTOSAVE_DELAY_MS = 400;

export function EditorScreen({ id }: { id: string }) {
  const [workout, setWorkout] = useState<Workout | null | undefined>(() => workoutsRepo.peek(id));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef<Workout | null>(workout ?? null);
  const dirty = useRef(false);
  const skipLastRest = useSettings((s) => s.skipLastRest);

  useEffect(() => {
    if (latest.current) return;
    let cancelled = false;
    setLoadError(null);
    workoutsRepo
      .get(id)
      .then((w) => {
        if (cancelled) return;
        latest.current = w ?? null;
        setWorkout(w ?? null);
      })
      .catch((e: unknown) => !cancelled && setLoadError(String((e as Error)?.message ?? e)));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const flush = useCallback(() => {
    if (dirty.current && latest.current) {
      dirty.current = false;
      void workoutsRepo.save(latest.current);
    }
  }, []);

  // Enregistrement automatique, différé pendant la saisie et forcé en quittant l'écran.
  useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(flush, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [workout, flush]);

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  const update = useCallback((fn: (w: Workout) => Workout) => {
    if (!latest.current) return;
    const next = fn(latest.current);
    latest.current = next;
    dirty.current = true;
    setWorkout(next);
  }, []);

  const actions = useMemo<EditorActions>(
    () => ({
      patch: (nodeId, patch) => update((w) => ({ ...w, children: updateNode(w.children, nodeId, patch) })),
      remove: (nodeId) => update((w) => ({ ...w, children: removeNode(w.children, nodeId) })),
      move: (nodeId, delta) => update((w) => ({ ...w, children: moveNode(w.children, nodeId, delta) })),
      duplicate: (nodeId) => update((w) => ({ ...w, children: duplicateNode(w.children, nodeId) })),
      add: (parentId, node) => update((w) => ({ ...w, children: appendNode(w.children, parentId, node) })),
    }),
    [update],
  );

  if (loadError) {
    return (
      <MessageScreen title="Impossible d’ouvrir la séance" detail={loadError}>
        <button type="button" className="btn primary" onClick={() => setAttempt((n) => n + 1)}>
          Réessayer
        </button>
      </MessageScreen>
    );
  }
  if (workout === undefined) return <MessageScreen title="Chargement…" />;
  if (workout === null) {
    return <MessageScreen title="Séance introuvable." />;
  }

  const total = totalDuration(workout.children, { skipLastRest });

  return (
    <div className="screen editor">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={goBack} aria-label="Retour">
          <BackIcon />
        </button>
        <input
          className="title-input"
          value={workout.name}
          aria-label="Nom de la séance"
          onChange={(e) => update((w) => ({ ...w, name: e.target.value }))}
          onBlur={(e) => !e.target.value.trim() && update((w) => ({ ...w, name: 'Séance sans nom' }))}
        />
      </header>

      <EditorContext.Provider value={actions}>
        <NodeList nodes={workout.children} depth={0} parentId={null} />
      </EditorContext.Provider>

      <footer className="bottom-bar">
        <span className="total">
          Durée totale <strong>{formatClock(total)}</strong>
        </span>
        <button
          type="button"
          className="btn primary"
          disabled={total === 0}
          onClick={() => {
            flush();
            navigate(`/run/${workout.id}`, { replace: true });
          }}
        >
          <PlayIcon size={20} /> Lancer
        </button>
      </footer>
    </div>
  );
}
