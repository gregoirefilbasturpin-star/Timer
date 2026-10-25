import { useState, type ReactNode } from 'react';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface NumberFieldProps {
  value: number;
  max: number;
  onCommit: (value: number) => void;
  pad?: boolean;
  label: string;
}

/** Champ numérique court : la saisie est validée à la sortie du champ. */
export function NumberField({ value, max, onCommit, pad = false, label }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (pad ? String(value).padStart(2, '0') : String(value));
  return (
    <input
      className="num-field"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={label}
      value={shown}
      onFocus={(e) => {
        setDraft(shown);
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
      onBlur={() => {
        if (draft !== null) onCommit(clamp(parseInt(draft, 10) || 0, 0, max));
        setDraft(null);
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

interface DurationInputProps {
  value: number;
  onChange: (seconds: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function DurationInput({ value, onChange, min = 1, max = 99 * 60 + 59, step = 5 }: DurationInputProps) {
  const m = Math.floor(value / 60);
  const s = value % 60;
  const set = (v: number) => onChange(clamp(Math.round(v), min, max));
  return (
    <div className="duration-input">
      <button type="button" className="icon-btn small" onClick={() => set(value - step)} aria-label={`Moins ${step} secondes`}>
        −
      </button>
      <NumberField value={m} max={99} label="Minutes" onCommit={(mm) => set(mm * 60 + s)} />
      <span className="sep">:</span>
      <NumberField value={s} max={59} pad label="Secondes" onCommit={(ss) => set(m * 60 + ss)} />
      <button type="button" className="icon-btn small" onClick={() => set(value + step)} aria-label={`Plus ${step} secondes`}>
        +
      </button>
    </div>
  );
}

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label: string;
}

export function Stepper({ value, onChange, min, max, label }: StepperProps) {
  const set = (v: number) => onChange(clamp(v, min, max));
  return (
    <div className="stepper">
      <button type="button" className="icon-btn small" onClick={() => set(value - 1)} aria-label={`${label} : moins`}>
        −
      </button>
      <NumberField value={value} max={max} label={label} onCommit={(v) => set(v)} />
      <button type="button" className="icon-btn small" onClick={() => set(value + 1)} aria-label={`${label} : plus`}>
        +
      </button>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, children, hint, disabled }: ToggleProps) {
  return (
    <label className={`toggle${disabled ? ' disabled' : ''}`}>
      <span className="toggle-text">
        {children}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}
