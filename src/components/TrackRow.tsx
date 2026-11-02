import type { Track } from '../types';

interface TrackRowProps {
  label: string;
  track: Track;
  tone: 'hp' | 'secondary' | 'armor' | 'structure';
  showTemp?: boolean;
  onDamage?: (amount: number) => void;
  onHeal?: (amount: number) => void;
  hint?: string;
}

export function TrackRow({
  label,
  track,
  tone,
  showTemp = false,
  onDamage,
  onHeal,
  hint,
}: TrackRowProps) {
  const ratio = track.max > 0 ? track.current / track.max : 0;
  const percent = Math.max(0, Math.min(100, ratio * 100));
  const state = ratio <= 0 ? 'empty' : ratio <= 0.25 ? 'critical' : ratio <= 0.5 ? 'low' : 'ok';
  const showButtons = Boolean(onDamage || onHeal) && track.max > 0;

  return (
    <div className={`track track-${tone} state-${state}`} title={hint}>
      <div className="track-head">
        <span className="track-label">{label}</span>
        <span className="track-numbers">
          <strong>{track.current}</strong>
          <span className="track-max">/ {track.max}</span>
          {showTemp && track.temp > 0 ? (
            <span className="temp-pill">+{track.temp} temp</span>
          ) : null}
        </span>
      </div>
      <div
        className="bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={track.max}
        aria-valuenow={track.current}
      >
        <div className="bar-fill" style={{ width: `${percent}%` }} />
      </div>
      {showButtons ? (
        <div className="track-actions">
          <button
            type="button"
            className="qbtn"
            onClick={() => onDamage?.(5)}
            title={`${label}: damage 5`}
            aria-label={`${label}: damage 5`}
          >
            −5
          </button>
          <button
            type="button"
            className="qbtn"
            onClick={() => onDamage?.(1)}
            title={`${label}: damage 1`}
            aria-label={`${label}: damage 1`}
          >
            −1
          </button>
          <button
            type="button"
            className="qbtn"
            onClick={() => onHeal?.(1)}
            title={`${label}: heal 1`}
            aria-label={`${label}: heal 1`}
          >
            +1
          </button>
          <button
            type="button"
            className="qbtn"
            onClick={() => onHeal?.(5)}
            title={`${label}: heal 5`}
            aria-label={`${label}: heal 5`}
          >
            +5
          </button>
        </div>
      ) : null}
    </div>
  );
}
