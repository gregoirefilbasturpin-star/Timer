const pad = (n: number): string => String(n).padStart(2, '0');

/** 75 → « 1:15 », 3725 → « 1:02:05 ». */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** Arrondi à la seconde supérieure, comme un compte à rebours. */
export function formatCountdown(ms: number): string {
  return formatClock(Math.ceil(ms / 1000));
}
