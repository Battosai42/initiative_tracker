import { useStore } from '../state/store';
import { CombatantCard } from './CombatantCard';
import { DeadList } from './DeadList';

export function InitiativeList() {
  const { displayCombatants, system } = useStore();
  const alive = displayCombatants.filter((combatant) => !combatant.defeated);
  const dead = displayCombatants.filter((combatant) => combatant.defeated);

  if (displayCombatants.length === 0) {
    return (
      <section className="empty">
        <div className="empty-mark" aria-hidden="true">
          d20
        </div>
        <h2>No combatants yet</h2>
        <p>{system.blurb} Add players and monsters above to begin.</p>
        <p className="muted">
          Tip: set <strong>Qty</strong> to 4 and add “Goblin” to get Goblin 1–4 with their own
          initiative rolls.
        </p>
      </section>
    );
  }

  return (
    <>
      {alive.length > 0 ? (
        <section className="initiative-list" aria-label="Initiative order">
          <div className="list-head">
            <h2>Initiative order</h2>
            <span className="muted">
              {alive.length} combatant{alive.length === 1 ? '' : 's'}
            </span>
          </div>
          {alive.map((combatant) => (
            <CombatantCard key={combatant.id} combatant={combatant} />
          ))}
        </section>
      ) : (
        <section className="empty all-dead">
          <h2>No one left standing</h2>
          <p className="muted">Revive someone from the dead list below to continue the fight.</p>
        </section>
      )}
      <DeadList combatants={dead} />
    </>
  );
}
