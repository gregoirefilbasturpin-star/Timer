import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BackIcon } from '../components/Icons';
import { Toggle } from '../components/inputs';
import { goBack } from '../hooks/useRoute';
import { canShareFiles, downloadBackup, importFile, shareBackup } from '../services/backup';
import { isStoragePersistent, requestPersistentStorage } from '../services/db';
import { feedback } from '../services/feedback';
import { promptInstall, useInstallAvailable } from '../services/pwa';
import { speech } from '../services/speech';
import { useSettings } from '../store/settings';

function useFrenchVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState(() => speech.getVoices());
  useEffect(() => speech.subscribe(() => setVoices(speech.getVoices())), []);
  return voices;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      <div className="settings-card">{children}</div>
    </section>
  );
}

export function SettingsScreen() {
  const s = useSettings();
  const voices = useFrenchVoices();
  const installAvailable = useInstallAvailable();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);

  useEffect(() => {
    void isStoragePersistent().then(setPersistent);
  }, []);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = await importFile(file);
      const parts = [`${result.workouts} séance${result.workouts > 1 ? 's' : ''} importée${result.workouts > 1 ? 's' : ''}`];
      if (result.settings) parts.push('paramètres restaurés');
      setMessage(parts.join(', ') + '.');
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <div className="screen settings">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={goBack} aria-label="Retour">
          <BackIcon />
        </button>
        <h1>Paramètres</h1>
      </header>

      <Section title="Séances">
        <Toggle
          checked={s.skipLastRest}
          onChange={(skipLastRest) => s.update({ skipLastRest })}
          hint="Au dernier tour d’un bloc, le repos qui termine le bloc est supprimé."
        >
          Sauter le dernier repos des blocs
        </Toggle>
      </Section>

      <Section title="Annonces vocales">
        <Toggle checked={s.voice} onChange={(voice) => s.update({ voice })} hint="Nom de l’exercice au début de chaque étape.">
          Annonces vocales
        </Toggle>
        {!speech.supported && <p className="warning">La synthèse vocale n’est pas disponible dans ce navigateur.</p>}
        {speech.supported && voices.length === 0 && (
          <p className="warning">
            Aucune voix française installée. Android : Paramètres › Synthèse vocale › Moteur Google › Installer les données vocales › Français.
          </p>
        )}
        {voices.length > 0 && (
          <label className="field">
            <span>Voix</span>
            <select value={s.voiceURI ?? ''} disabled={!s.voice} onChange={(e) => s.update({ voiceURI: e.target.value || null })}>
              <option value="">Automatique</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} {v.localService ? '' : '(en ligne)'}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Vitesse : {s.voiceRate.toFixed(2)}×</span>
          <input type="range" min={0.7} max={1.6} step={0.05} value={s.voiceRate} disabled={!s.voice} onChange={(e) => s.update({ voiceRate: Number(e.target.value) })} />
        </label>
        <Toggle checked={s.announceDuration} disabled={!s.voice} onChange={(announceDuration) => s.update({ announceDuration })} hint="« Squats, 30 secondes ». La charge est toujours annoncée si elle est renseignée.">
          Annoncer la durée
        </Toggle>
        <Toggle checked={s.announceNext} disabled={!s.voice} onChange={(announceNext) => s.update({ announceNext })} hint="Pendant le repos et la préparation : « Ensuite, pompes ».">
          Annoncer l’exercice suivant
        </Toggle>
        <Toggle checked={s.announceRound} disabled={!s.voice} onChange={(announceRound) => s.update({ announceRound })} hint="« Pompes, Tour 2 sur 4 »">
          Annoncer le tour
        </Toggle>
      </Section>

      <Section title="Sons et vibrations">
        <Toggle checked={s.beeps} onChange={(beeps) => s.update({ beeps })} hint="Bips 3-2-1, signal de départ et de fin.">
          Bips
        </Toggle>
        <label className="field">
          <span>Volume des bips : {Math.round(s.volume * 100)} %</span>
          <input type="range" min={0.1} max={1} step={0.05} value={s.volume} disabled={!s.beeps} onChange={(e) => s.update({ volume: Number(e.target.value) })} />
        </label>
        <Toggle checked={s.vibration} onChange={(vibration) => s.update({ vibration })}>
          Vibrations
        </Toggle>
        <button type="button" className="btn" onClick={feedback.test}>
          Tester le son et la voix
        </button>
      </Section>

      <Section title="Sauvegarde">
        <p className="hint">
          Les séances sont enregistrées automatiquement sur ce téléphone. Exportez une sauvegarde pour changer d’appareil ou vous prémunir d’une
          réinitialisation du navigateur.
        </p>
        <p className="hint">
          Stockage protégé contre l’effacement automatique :{' '}
          {persistent === null ? '…' : persistent ? <strong>oui</strong> : <strong>non</strong>}
          {persistent === false && (
            <button type="button" className="link-btn" onClick={() => void requestPersistentStorage().then(setPersistent)}>
              Demander
            </button>
          )}
        </p>
        <div className="button-row">
          <button type="button" className="btn" onClick={() => void downloadBackup()}>
            Télécharger la sauvegarde
          </button>
          {canShareFiles() && (
            <button type="button" className="btn" onClick={() => void shareBackup().catch((e: Error) => setMessage(e.message))}>
              Partager…
            </button>
          )}
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            Importer un fichier
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void onImport(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {message && <p className="notice">{message}</p>}
      </Section>

      {installAvailable && (
        <Section title="Application">
          <button type="button" className="btn primary" onClick={() => void promptInstall()}>
            Installer sur l’écran d’accueil
          </button>
        </Section>
      )}

      <p className="version">Timer v{__APP_VERSION__} · fonctionne entièrement hors-ligne</p>
    </div>
  );
}
