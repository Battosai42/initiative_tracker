import { useStore } from '../state/store';
import { activeSide as battletechActiveSide, roundComplete } from '../lib/battletech';

export function TurnBar() {
  const {
    encounter,
    system,
    activeCombatant,
    previous,
    next,
    rollAllInitiatives,
    rollBtSides,
    nextBtSide,
  } = useStore();

  const isBt = system.id === 'battletech';
  const btSide = isBt ? battletechActiveSide(encounter) : null;
  const btDone = isBt && roundComplete(encounter);
  const hasCombatants = encounter.combatants.length > 0;
  const canGoBack = !isBt && system.id !== 'shadowrun';

  const activeLabel = isBt
    ? (btSide ??
      (!encounter.btOrder.length
        ? 'Roll side initiative'
        : btDone
          ? 'Round complete'
          : 'Next side'))
    : (activeCombatant?.name ?? (hasCombatants ? 'Not started' : 'No combatants'));

  return (
    <section className="turnbar" aria-label="Turn controls">
      <div className="round-box">
        <span className="eyebrow">Round</span>
        <strong>{encounter.round}</strong>
      </div>

      <div className="active-box">
        <span className="eyebrow">{isBt ? 'Active side' : 'Active combatant'}</span>
        <strong className={activeLabel === 'Round complete' ? 'complete' : ''}>{activeLabel}</strong>
        {!isBt && activeCombatant && activeCombatant.conditions.length > 0 ? (
          <span className="muted">
            {activeCombatant.conditions.length} condition
            {activeCombatant.conditions.length === 1 ? '' : 's'}
          </span>
        ) : null}
        {isBt ? (
          <span className="muted">
            {encounter.btOrder.length
              ? `${encounter.btOrder.length} activations this round`
              : '2d6 per side · winner activates first'}
          </span>
        ) : null}
        {system.id === 'shadowrun' ? (
          <span className="muted">Scores drop by 10 each pass</span>
        ) : null}
      </div>

      <div className="turn-actions">
        {canGoBack ? (
          <button
            className="btn"
            onClick={previous}
            disabled={!hasCombatants}
            title="Previous turn (P)"
            aria-label="Previous turn"
          >
            <span aria-hidden="true">←</span>
            <span className="btn-label">Prev</span>
          </button>
        ) : null}
        <button
          className="btn primary"
          onClick={isBt ? nextBtSide : next}
          disabled={!hasCombatants}
          title={isBt ? 'Next side' : 'Next turn (N)'}
          aria-label={isBt ? 'Next side' : 'Next turn'}
        >
          <span className="btn-label">{isBt ? 'Next side' : 'Next turn'}</span>
          <span aria-hidden="true">→</span>
        </button>
        <button
          className="btn"
          onClick={isBt ? rollBtSides : rollAllInitiatives}
          disabled={!hasCombatants}
          title={isBt ? 'Roll 2d6 for every side' : 'Roll initiative for every combatant'}
          aria-label={isBt ? 'Roll sides' : 'Roll all'}
        >
          <span aria-hidden="true">↻</span>
          <span className="btn-label">{isBt ? 'Roll sides' : 'Roll all'}</span>
        </button>
      </div>
    </section>
  );
}
