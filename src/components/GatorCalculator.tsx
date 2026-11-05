import type { Combatant, GatorState } from '../types';
import { useStore } from '../state/store';
import { CommitNumberInput } from './CommitNumberInput';
import { btLocationTotals } from '../lib/mech';
import {
  ATTACKER_MOVEMENT_OPTIONS,
  RANGE_OPTIONS,
  TARGET_MOVEMENT_OPTIONS,
  gatorBreakdown,
  pilotingBreakdown,
  pilotingDamageModifier,
  signed,
  twoDiceOdds,
} from '../lib/gator';

/**
 * BattleTech GATOR calculator shown on an expanded combatant card. The
 * selections are per-combatant, while Gunnery and Piloting are template stats
 * that can be edited directly here as well.
 */
export function GatorCalculator({ combatant }: { combatant: Combatant }) {
  const { updateCombatant } = useStore();
  const gator = combatant.gator;
  const breakdown = gatorBreakdown(combatant);
  const odds = twoDiceOdds(breakdown.total);
  const totals = btLocationTotals(combatant.locations);
  const totalDamage =
    (totals.armor.max - totals.armor.current) +
    (totals.structure.max - totals.structure.current);
  const damageModifier = pilotingDamageModifier(totalDamage);
  const piloting = pilotingBreakdown(combatant, damageModifier);
  const pilotingOdds = twoDiceOdds(piloting.total);

  const setGator = (update: Partial<GatorState>) => {
    updateCombatant(combatant.id, (current) => ({
      ...current,
      gator: { ...current.gator, ...update },
    }));
  };

  return (
    <div className="expanded-section gator-section">
      <div className="section-head">
        <h4>GATOR</h4>
        <span className="gator-results">
          <span className="gator-result">
            Attack DC <strong>{breakdown.total}</strong>
            <span className="muted"> · {odds}% on 2d6</span>
          </span>
          <span className="gator-result gator-piloting-result">
            Piloting DC <strong>{piloting.total}</strong>
            <span className="muted"> · {pilotingOdds}% on 2d6</span>
          </span>
        </span>
      </div>

      <div className="gator-grid">
        <div className="gator-row">
          <span className="gator-key">G</span>
          <span className="gator-label">Base skills</span>
          <div className="gator-options">
            <label className="gator-number">
              <span>Gunnery (attack)</span>
              <CommitNumberInput
                min={0}
                max={12}
                value={combatant.gunnery}
                label="Gunnery skill"
                immediate
                onCommit={(gunnery) => updateCombatant(combatant.id, { gunnery })}
              />
            </label>
            <label className="gator-number">
              <span>Piloting (check)</span>
              <CommitNumberInput
                min={0}
                max={12}
                value={combatant.piloting}
                label="Piloting skill"
                immediate
                onCommit={(piloting) => updateCombatant(combatant.id, { piloting })}
              />
            </label>
          </div>
        </div>

        <div className="gator-row">
          <span className="gator-key">A</span>
          <span className="gator-label">Attacker movement</span>
          <div className="gator-options">
            {ATTACKER_MOVEMENT_OPTIONS.map((option) => {
              const selected = gator.attackerMovement === option.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  className={`gator-option ${selected ? 'is-selected' : ''}`}
                  onClick={() => setGator({ attackerMovement: option.value })}
                  aria-pressed={selected}
                  title={`${option.label} (${signed(option.modifier)})`}
                >
                  <span className="gator-check" aria-hidden="true">
                    {selected ? '✓' : ''}
                  </span>
                  {option.label}
                  <span className="gator-mod">{signed(option.modifier)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="gator-row">
          <span className="gator-key">T</span>
          <span className="gator-label">Target movement</span>
          <div className="gator-options">
            {TARGET_MOVEMENT_OPTIONS.map((option) => {
              const selected = gator.targetMovement === option.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  className={`gator-option ${selected ? 'is-selected' : ''}`}
                  onClick={() => setGator({ targetMovement: option.value })}
                  aria-pressed={selected}
                  disabled={gator.targetImmobile}
                  title={`${option.label} hexes (${signed(option.modifier)})`}
                >
                  <span className="gator-check" aria-hidden="true">
                    {selected ? '✓' : ''}
                  </span>
                  {option.label}
                  <span className="gator-mod">{signed(option.modifier)}</span>
                </button>
              );
            })}
            <label className="gator-checkbox" title="Jumping targets add another +1">
              <input
                type="checkbox"
                checked={gator.targetJumped}
                disabled={gator.targetImmobile}
                onChange={(event) => setGator({ targetJumped: event.target.checked })}
              />
              Jumped
              <span className="gator-mod">+1</span>
            </label>
            <label
              className="gator-checkbox"
              title="Immobile targets use -4 instead of their movement modifier"
            >
              <input
                type="checkbox"
                checked={gator.targetImmobile}
                onChange={(event) =>
                  setGator({
                    targetImmobile: event.target.checked,
                    targetJumped: event.target.checked ? false : gator.targetJumped,
                  })
                }
              />
              Immobile
              <span className="gator-mod">−4</span>
            </label>
          </div>
        </div>

        <div className="gator-row">
          <span className="gator-key">O</span>
          <span className="gator-label">Other</span>
          <div className="gator-options">
            <label className="gator-checkbox" title="Include the modifier from this unit's heat">
              <input
                type="checkbox"
                checked={gator.useHeat}
                onChange={(event) => setGator({ useHeat: event.target.checked })}
              />
              Heat
              <span className={`gator-mod ${breakdown.heat > 0 ? 'warn' : ''}`}>
                {signed(breakdown.heat)}
              </span>
            </label>
            <label className="gator-checkbox" title="Include +1 per pilot hit">
              <input
                type="checkbox"
                checked={gator.usePilotHits}
                onChange={(event) => setGator({ usePilotHits: event.target.checked })}
              />
              Pilot hits
              <span className={`gator-mod ${breakdown.pilotHits > 0 ? 'warn' : ''}`}>
                {signed(breakdown.pilotHits)}
              </span>
            </label>
            <label className="gator-number gator-other">
              <span>Other</span>
              <CommitNumberInput
                min={-20}
                max={20}
                value={gator.other}
                label="Other GATOR modifiers"
                title="Woods, partial cover, minimum range, damage and similar modifiers"
                onCommit={(other) => setGator({ other })}
              />
            </label>
          </div>
        </div>

        <div className="gator-row">
          <span className="gator-key">R</span>
          <span className="gator-label">Range</span>
          <div className="gator-options">
            {RANGE_OPTIONS.map((option) => {
              const selected = gator.range === option.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  className={`gator-option ${selected ? 'is-selected' : ''}`}
                  onClick={() => setGator({ range: option.value })}
                  aria-pressed={selected}
                  title={`${option.label} range (${signed(option.modifier)})`}
                >
                  <span className="gator-check" aria-hidden="true">
                    {selected ? '✓' : ''}
                  </span>
                  {option.label}
                  <span className="gator-mod">{signed(option.modifier)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="gator-row">
          <span className="gator-key">P</span>
          <span className="gator-label">Piloting check</span>
          <div className="gator-options">
            <label
              className="gator-checkbox"
              title="Add +1 per 20 points of damage taken (20-39: +1, 40-59: +2, 60-79: +3, 80+: +4)"
            >
              <input
                type="checkbox"
                checked={gator.usePilotingDamage}
                onChange={(event) => setGator({ usePilotingDamage: event.target.checked })}
              />
              Damage
              <span className={`gator-mod ${piloting.damage > 0 ? 'warn' : ''}`}>
                {signed(piloting.damage)}
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="gator-breakdown" aria-label="GATOR breakdown">
        <span>G {breakdown.gunnery}</span>
        <span>A {signed(breakdown.attacker)}</span>
        <span>T {signed(breakdown.target)}</span>
        <span>O {signed(breakdown.other)}</span>
        <span>R {signed(breakdown.range)}</span>
        <strong>= {breakdown.total}</strong>
      </div>

      <div className="gator-breakdown gator-piloting-breakdown" aria-label="Piloting check breakdown">
        <span className="gator-breakdown-label">Piloting</span>
        <span>P {piloting.piloting}</span>
        <span>D {signed(piloting.damage)}</span>
        <span>O {signed(piloting.other)}</span>
        <strong>= {piloting.total}</strong>
      </div>
    </div>
  );
}
