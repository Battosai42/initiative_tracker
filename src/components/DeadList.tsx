import type { Combatant } from '../types';
import { useStore } from '../state/store';

const ROLE_LABELS: Record<Combatant['role'], string> = {
  pc: 'PC',
  monster: 'Monster',
  npc: 'NPC',
};

interface DeadListProps {
  combatants: Combatant[];
}

export function DeadList({ combatants }: DeadListProps) {
  const { system, toggleDefeated, removeCombatant } = useStore();
  if (combatants.length === 0) return null;

  const isBt = system.id === 'battletech';
  const title = isBt ? 'Destroyed units' : 'Dead';

  return (
    <section className="dead-panel" aria-label={title}>
      <div className="list-head">
        <h2>{title}</h2>
        <span className="muted">
          {combatants.length} {isBt ? 'destroyed' : 'dead'} · skipped in turn order
        </span>
      </div>
      <div className="dead-list">
        {combatants.map((combatant) => {
          const meta = isBt
            ? `${combatant.armor.current}/${combatant.armor.max} armor · ${combatant.structure.current}/${combatant.structure.max} structure`
            : `${combatant.hp.current}/${combatant.hp.max} ${system.primaryLabel}`;
          return (
            <div className="dead-row" key={combatant.id}>
              <span className="dead-skull" aria-hidden="true">
                ☠
              </span>
              <span className="dead-name">{combatant.name}</span>
              <span className={`role-badge role-${combatant.role}`}>
                {ROLE_LABELS[combatant.role]}
              </span>
              {isBt ? (
                <span className="side-badge">{combatant.side || 'Unassigned'}</span>
              ) : null}
              <span className="dead-meta">{meta}</span>
              <div className="dead-actions">
                <button
                  type="button"
                  className="btn small"
                  onClick={() => toggleDefeated(combatant.id)}
                >
                  {isBt ? 'Repair' : 'Revive'}
                </button>
                <button
                  type="button"
                  className="btn small danger"
                  onClick={() => removeCombatant(combatant.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
