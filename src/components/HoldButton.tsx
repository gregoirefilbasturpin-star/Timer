import { useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface HoldButtonProps {
  onHold: () => void;
  children: ReactNode;
  className?: string;
  durationMs?: number;
  label?: string;
}

/** Bouton à maintenir appuyé : évite les actions accidentelles pendant l'effort. */
export function HoldButton({ onHold, children, className = '', durationMs = 800, label }: HoldButtonProps) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const cancel = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };

  return (
    <button
      type="button"
      aria-label={label}
      className={`hold-btn ${className}`}
      data-holding={holding}
      style={{ '--hold-ms': `${durationMs}ms` } as CSSProperties}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setHolding(true);
        timer.current = window.setTimeout(() => {
          setHolding(false);
          onHold();
        }, durationMs);
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="hold-fill" aria-hidden="true" />
      <span className="hold-content">{children}</span>
    </button>
  );
}
