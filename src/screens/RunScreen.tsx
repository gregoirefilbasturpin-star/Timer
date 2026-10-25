import { useEffect, useState, type CSSProperties } from 'react';
import { HoldButton } from '../components/HoldButton';
import { CloseIcon, LockIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon } from '../components/Icons';
import { createRun, progress, remainingMs, type Run } from '../engine/engine';
import { formatClock, formatCountdown } from '../model/format';
import { KIND_LABELS } from '../model/types';
import { goBack } from '../hooks/useRoute';
import { workoutsRepo } from '../services/db';
import { wakeLock } from '../services/device';
import { feedback } from '../services/feedback';
import { speech } from '../services/speech';
import { loadStoredRun, runActions, useRun } from '../store/run';
import { useSettings } from '../store/settings';

const TICK_MS = 100;

export function RunScreen({ workoutId }: { workoutId?: string }) {
  const run = useRun((s) => s.run);
  const [missing, setMissing] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (workoutId) {
      workoutsRepo.get(workoutId).then((w) => {
        if (cancelled) return;
        const r = w && createRun(w);
        if (r) runActions.load(r);
        else setMissing(true);
      });
    } else {
      const r = loadStoredRun();
      if (r) {
        runActions.load(r);
        setRestored(true);
      } else {
        setMissing(true);
      }
    }
    return () => {
      cancelled = true;
      runActions.leave();
      void wakeLock.release();
    };
  }, [workoutId]);

  const status = run?.status;

  useEffect(() => {
    if (status !== 'running') return;
    const timer = window.setInterval(runActions.tick, TICK_MS);
    const onVisibility = () => (document.visibilityState === 'visible' ? runActions.tick() : runActions.persistNow());
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', runActions.persistNow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', runActions.persistNow);
    };
  }, [status]);

  useEffect(() => {
    if (status === 'running' || status === 'paused') void wakeLock.acquire();
    else void wakeLock.release();
  }, [status]);

  if (missing) {
    return (
      <div className="screen">
        <p className="empty">Séance introuvable.</p>
        <button type="button" className="btn" onClick={goBack}>
          Retour
        </button>
      </div>
    );
  }
  if (!run) return <div className="screen run" />;
  if (run.status === 'finished') return <FinishedView run={run} />;
  if (run.status === 'ready' || restored) {
    return (
      <StartView
        run={run}
        onStart={() => {
          feedback.prime();
          setRestored(false);
          runActions.start();
        }}
      />
    );
  }
  return <ActiveView run={run} />;
}

function StartView({ run, onStart }: { run: Run; onStart: () => void }) {
  const voiceEnabled = useSettings((s) => s.voice);
  const [hasVoice, setHasVoice] = useState(() => speech.getVoices().length > 0);
  useEffect(() => speech.subscribe(() => setHasVoice(speech.getVoices().length > 0)), []);
  const resuming = run.status === 'paused';
  const step = run.steps[run.index];

  return (
    <div className="screen run start-view">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={goBack} aria-label="Retour">
          <CloseIcon />
        </button>
      </header>
      <div className="start-content">
        <h1>{run.workoutName}</h1>
        {resuming ? (
          <p className="start-meta">
            Reprise à l’étape {run.index + 1}/{run.steps.length} : <strong>{step.label}</strong>, {formatCountdown(run.remainingMs)} restant
          </p>
        ) : (
          <p className="start-meta">
            {formatClock(run.totalDuration)} · {run.steps.length} étapes
          </p>
        )}
        {voiceEnabled && (!speech.supported || !hasVoice) && (
          <p className="warning">
            Aucune voix française détectée. Sur Android : Paramètres › Synthèse vocale › Moteur Google › Installer les données vocales › Français.
          </p>
        )}
        <button type="button" className="start-btn" onClick={onStart}>
          <PlayIcon size={40} />
          {resuming ? 'Reprendre' : 'Démarrer'}
        </button>
      </div>
    </div>
  );
}

function ActiveView({ run }: { run: Run }) {
  const now = useRun((s) => s.now);
  const [locked, setLocked] = useState(false);
  const step = run.steps[run.index];
  const following = run.steps[run.index + 1];
  const left = remainingMs(run, now);
  const total = progress(run, now);
  const stepRatio = run.stepTotalMs > 0 ? 1 - left / run.stepTotalMs : 0;
  const paused = run.status === 'paused';

  return (
    <div className={`screen run active kind-${step.kind}${paused ? ' paused' : ''}`}>
      <header className="run-top">
        {locked ? (
          <span className="lock-hint">
            <LockIcon size={18} /> Verrouillé
          </span>
        ) : (
          <HoldButton className="icon-btn" label="Maintenir pour quitter" onHold={() => {
              runActions.quit();
              goBack();
            }}
          >
            <CloseIcon />
          </HoldButton>
        )}
        <span className="run-title">{run.workoutName}</span>
        <span className="step-count">
          {run.index + 1}/{run.steps.length}
        </span>
      </header>

      <section className="run-main">
        {step.rounds.length > 0 && (
          <div className="rounds">
            {step.rounds.map((r, i) => (
              <span key={i} className={i === step.rounds.length - 1 ? 'round current' : 'round'}>
                {r.label} {r.current}/{r.total}
              </span>
            ))}
          </div>
        )}
        {(step.betweenRounds || step.label !== KIND_LABELS[step.kind]) && (
          <span className="kind-label">{step.betweenRounds ? 'Entre les tours' : KIND_LABELS[step.kind]}</span>
        )}
        <h1 className="step-name">{step.label}</h1>
        {(step.load || step.description) && <p className="step-details">{[step.load, step.description].filter(Boolean).join(' · ')}</p>}
        <div className="time" aria-live="off">
          {formatCountdown(left)}
        </div>
        <div className="step-bar">
          <span style={{ '--ratio': stepRatio } as CSSProperties} />
        </div>
        {paused && <p className="paused-label">En pause</p>}
      </section>

      <section className="next-up">
        <span className="next-label">Ensuite</span>
        {following ? (
          <span className={`next-name kind-${following.kind}`}>
            {following.label} · {formatClock(following.duration)}
          </span>
        ) : (
          <span className="next-name">Fin de la séance</span>
        )}
      </section>

      <section className="total-progress">
        <div className="total-bar">
          <span style={{ '--ratio': total.ratio } as CSSProperties} />
        </div>
        <div className="total-meta">
          <span>{Math.round(total.ratio * 100)} %</span>
          <span>Reste {formatCountdown(total.remainingTotalMs)}</span>
        </div>
      </section>

      {locked ? (
        <footer className="controls">
          <HoldButton className="unlock-btn" onHold={() => setLocked(false)}>
            <LockIcon size={22} /> Maintenir pour déverrouiller
          </HoldButton>
        </footer>
      ) : (
        <footer className="controls">
          <button type="button" className="ctrl" onClick={() => setLocked(true)} aria-label="Verrouiller les commandes">
            <LockIcon />
          </button>
          <button type="button" className="ctrl" onClick={runActions.previous} aria-label="Étape précédente">
            <PrevIcon size={30} />
          </button>
          <button type="button" className="ctrl main" onClick={runActions.toggle} aria-label={paused ? 'Reprendre' : 'Pause'}>
            {paused ? <PlayIcon size={44} /> : <PauseIcon size={44} />}
          </button>
          <button type="button" className="ctrl" onClick={runActions.next} aria-label="Étape suivante">
            <NextIcon size={30} />
          </button>
          <button type="button" className="ctrl text" onClick={() => runActions.addTime(10_000)} aria-label="Ajouter 10 secondes">
            +10 s
          </button>
        </footer>
      )}
    </div>
  );
}

function FinishedView({ run }: { run: Run }) {
  return (
    <div className="screen run finished-view">
      <div className="start-content">
        <p className="kind-label">Séance terminée</p>
        <h1>Bravo !</h1>
        <p className="start-meta">
          {run.workoutName} · {formatClock(run.totalDuration)} · {run.steps.length} étapes
        </p>
        <div className="finished-actions">
          <button type="button" className="btn primary wide" onClick={goBack}>
            Retour à l’accueil
          </button>
          <button type="button" className="btn wide" onClick={runActions.restart}>
            Recommencer
          </button>
        </div>
      </div>
    </div>
  );
}
