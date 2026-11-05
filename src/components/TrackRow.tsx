import { useRef, useState } from 'react';
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

interface DeltaInputProps {
  label: string;
  onApply: (delta: number) => void;
  /** Wording used in the tooltip for positive values (default "heal"). */
  increaseHint?: string;
  /** Wording used in the tooltip for negative values (default "damage"). */
  decreaseHint?: string;
}

/**
 * A single compact field for adjusting a track. Type a positive number to
 * heal, a negative number to damage, then press Enter (or blur) to apply.
 */
export function DeltaInput({
  label,
  onApply,
  increaseHint = 'heal',
  decreaseHint = 'damage',
}: DeltaInputProps) {
  const [draft, setDraft] = useState('');
  const cancelled = useRef(false);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return;
    const delta = Math.round(parsed);
    if (delta !== 0) onApply(delta);
  };

  return (
    <input
      className="track-delta"
      type="text"
      autoComplete="off"
      value={draft}
      placeholder="±"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          cancelled.current = true;
          setDraft('');
          event.currentTarget.blur();
        }
      }}
      aria-label={`${label}: enter a positive number to ${increaseHint} or a negative number to ${decreaseHint}, then press Enter`}
      title={`${label}: type +N to ${increaseHint} or -N to ${decreaseHint}, then press Enter`}
    />
  );
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
  const showDelta = Boolean(onDamage || onHeal) && track.max > 0;

  const applyDelta = (delta: number) => {
    if (delta < 0) onDamage?.(-delta);
    else onHeal?.(delta);
  };

  return (
    <div className={`track track-${tone} state-${state}`} title={hint}>
      <div className="track-head">
        <span className="track-label">{label}</span>
        <span className="track-side">
          <span className="track-numbers">
            <strong>{track.current}</strong>
            <span className="track-max">/ {track.max}</span>
            {showTemp && track.temp > 0 ? (
              <span className="temp-pill">+{track.temp} temp</span>
            ) : null}
          </span>
          {showDelta ? <DeltaInput label={label} onApply={applyDelta} /> : null}
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
    </div>
  );
}
