import { useStore } from '../state/store';
import {
  activeSide,
  activeSidePhase,
  BT_PHASE_LABELS,
  nextSide,
  rollSides,
  roundComplete,
  sideNames,
  unactedUnits,
  unitsForSide,
} from '../lib/battletech';

export function BattletechPanel() {
  const { encounter, system, mutate, notify } = useStore();
  if (system.id !== 'battletech') return null;

  const sides = sideNames(encounter);
  if (sides.length === 0) return null;
  const active = activeSide(encounter);
  const btPhase = activeSidePhase(encounter);
  const done = roundComplete(encounter);
  const started = encounter.btOrder.length > 0;
  const hasUnactedLive = encounter.combatants.some(
    (combatant) => !combatant.defeated && !combatant.acted,
  );

  const roll = () => {
    mutate((current) => rollSides(current));
    notify('Rolled side initiative');
  };

  return (
    <section className="panel bt-panel">
      <div className="panel-head">
        <div>
          <h2>Side initiative</h2>
          <p className="muted">
            Roll 2d6 per side. The winner activates a unit first, then sides alternate.
          </p>
        </div>
        <div className="bt-panel-actions">
          <button type="button" className="btn" onClick={roll}>
            Roll sides
          </button>
          {started && !active && !done && hasUnactedLive ? (
            <button
              type="button"
              className="btn"
              onClick={() => mutate((current) => nextSide(current))}
            >
              Next side →
            </button>
          ) : null}
        </div>
      </div>

      <div className="bt-sides">
        {sides.map((side) => {
          const sideRoll = encounter.sideRolls[side];
          const units = unitsForSide(encounter, side);
          const liveUnits = units.filter((unit) => !unit.defeated).length;
          const ready = unactedUnits(encounter, side).length;
          return (
            <div
              key={side}
              className={`bt-side ${active === side ? 'is-active' : ''} ${
                sideRoll === null || sideRoll === undefined ? 'is-unrolled' : ''
              }`}
            >
              <span className="bt-side-name">{side}</span>
              <span className="bt-side-roll">{sideRoll ?? '—'}</span>
              <span className="bt-side-meta">
                {liveUnits} unit{liveUnits === 1 ? '' : 's'} · {ready} ready
              </span>
              {active === side ? <span className="active-pill">Activating</span> : null}
            </div>
          );
        })}
      </div>

      {started ? (
        <p className="bt-order">
          <span className="mini-label">Activation order</span>
          {btPhase ? (
            <span className="bt-phase-chip" title="Current turn phase for the active side">
              {BT_PHASE_LABELS[btPhase]}
            </span>
          ) : null}
          {encounter.btOrder.map((side, index) => (
            <span key={`${side}-${index}`} className="bt-order-item">
              {index > 0 ? <span className="bt-arrow">›</span> : null}
              <span className={index === encounter.btIndex ? 'current' : ''}>{side}</span>
            </span>
          ))}
        </p>
      ) : (
        <p className="muted">Roll sides to create the activation order.</p>
      )}

      {done ? (
        <p className="muted">Round complete — the next activation starts a fresh round.</p>
      ) : null}
    </section>
  );
}
