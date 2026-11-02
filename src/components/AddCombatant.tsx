import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useStore } from '../state/store';
import { track } from '../lib/factory';
import { rollInitiativeScore } from '../lib/dice';
import { sideNames } from '../lib/battletech';
import type { Role } from '../types';

const ROLE_LABELS: Record<Role, string> = {
  pc: 'PC',
  monster: 'Monster',
  npc: 'NPC',
};

function toInt(value: string, fallback = 0): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function AddCombatant() {
  const { system, encounter, addCombatants } = useStore();
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('monster');
  const [side, setSide] = useState('OpFor');
  const [initMod, setInitMod] = useState('0');
  const [score, setScore] = useState('');
  const [autoRoll, setAutoRoll] = useState(true);
  const [hpMax, setHpMax] = useState('10');
  const [secondaryMax, setSecondaryMax] = useState('10');
  const [resolve, setResolve] = useState('3');
  const [armor, setArmor] = useState('10');
  const [structure, setStructure] = useState('5');
  const [quantity, setQuantity] = useState('1');
  const nameRef = useRef<HTMLInputElement>(null);

  const isBt = system.showBattletech;
  const secondaryLabel = system.secondaryLabel;

  useEffect(() => {
    if (system.id === 'shadowrun') {
      setHpMax('10');
      setSecondaryMax('10');
    } else if (system.id === 'starfinder1e') {
      setHpMax('10');
      setSecondaryMax('10');
    } else {
      setSecondaryMax('5');
    }
    if (isBt) {
      setArmor('10');
      setStructure('5');
      setSide((current) => (current === 'Players' || !current ? 'OpFor' : current));
    }
  }, [system.id, isBt]);

  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() !== 'a' || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      nameRef.current?.focus();
      nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    window.addEventListener('keydown', focus);
    return () => window.removeEventListener('keydown', focus);
  }, []);

  const pickRole = (next: Role) => {
    setRole(next);
    setSide(next === 'pc' ? 'Players' : 'OpFor');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const count = Math.max(1, Math.min(20, toInt(quantity, 1)));
    const baseName =
      name.trim() || (role === 'pc' ? 'Player' : role === 'monster' ? 'Monster' : 'NPC');
    const modifier = toInt(initMod, 0);
    const manualScore = score.trim() === '' ? null : Math.round(Number(score));
    const mode = system.initiative === 'shadowrun' ? 'shadowrun' : 'd20';
    const hpValue = Math.max(1, toInt(hpMax, 10));
    const secondaryValue = Math.max(0, toInt(secondaryMax, 0));
    const resolveValue = Math.max(0, toInt(resolve, 0));
    const armorValue = Math.max(0, toInt(armor, 0));
    const structureValue = Math.max(0, toInt(structure, 0));

    const drafts = Array.from({ length: count }, (_, index) => {
      const displayName = count > 1 ? `${baseName} ${index + 1}` : baseName;
      let initiative: number | null = null;
      if (!isBt) {
        initiative = autoRoll
          ? rollInitiativeScore(mode, modifier).total
          : manualScore !== null && Number.isFinite(manualScore)
            ? manualScore
            : null;
      }
      return {
        name: displayName,
        role,
        side: isBt ? side.trim() || (role === 'pc' ? 'Players' : 'OpFor') : role === 'pc' ? 'Players' : 'OpFor',
        initiative,
        initMod: modifier,
        tiebreak: modifier,
        hp: track(isBt ? 0 : hpValue),
        secondary: track(isBt || !secondaryLabel ? 0 : secondaryValue),
        resolve: system.showResolve ? resolveValue : 0,
        armor: track(isBt ? armorValue : 0),
        structure: track(isBt ? structureValue : 0),
      };
    });

    addCombatants(drafts);
    setName('');
    setScore('');
    nameRef.current?.focus();
  };

  const sides = sideNames(encounter);
  const addLabel = `Add ${toInt(quantity, 1) > 1 ? `${toInt(quantity, 1)} combatants` : 'combatant'}`;

  return (
    <section className="panel add-panel">
      <div className="panel-head">
        <div>
          <h2>Add combatant</h2>
          <p className="muted">
            {isBt
              ? 'Add units to a side. Side initiative is rolled with 2d6.'
              : `${system.initHint}. Monsters and NPCs can be added in groups.`}
          </p>
        </div>
        {!isBt ? (
          <label className="check">
            <input
              type="checkbox"
              checked={autoRoll}
              onChange={(event) => setAutoRoll(event.target.checked)}
            />
            Roll initiative
          </label>
        ) : null}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="add-grid">
          <div className="field field-name">
            <label htmlFor="add-name">Name</label>
            <input
              id="add-name"
              ref={nameRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={
                role === 'pc' ? 'Aria' : role === 'monster' ? 'Goblin' : 'Innkeeper'
              }
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label>Type</label>
            <div className="segmented" role="group" aria-label="Combatant type">
              {(['pc', 'monster', 'npc'] as Role[]).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className={role === entry ? 'is-selected' : ''}
                  onClick={() => pickRole(entry)}
                  aria-pressed={role === entry}
                >
                  {ROLE_LABELS[entry]}
                </button>
              ))}
            </div>
          </div>

          {isBt ? (
            <>
              <div className="field">
                <label htmlFor="add-side">Side</label>
                <input
                  id="add-side"
                  value={side}
                  onChange={(event) => setSide(event.target.value)}
                  list="side-options"
                  placeholder="OpFor"
                />
                <datalist id="side-options">
                  {sides.map((entry) => (
                    <option key={entry} value={entry} />
                  ))}
                </datalist>
              </div>
              <div className="field">
                <label htmlFor="add-armor">Armor</label>
                <input
                  id="add-armor"
                  type="number"
                  min={0}
                  value={armor}
                  onChange={(event) => setArmor(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="add-structure">Structure</label>
                <input
                  id="add-structure"
                  type="number"
                  min={0}
                  value={structure}
                  onChange={(event) => setStructure(event.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="add-init-mod">Init mod</label>
                <input
                  id="add-init-mod"
                  type="number"
                  value={initMod}
                  onChange={(event) => setInitMod(event.target.value)}
                  title={system.initHint}
                />
              </div>
              {!autoRoll ? (
                <div className="field">
                  <label htmlFor="add-score">Score</label>
                  <input
                    id="add-score"
                    type="number"
                    value={score}
                    onChange={(event) => setScore(event.target.value)}
                    placeholder="—"
                  />
                </div>
              ) : null}
              <div className="field">
                <label htmlFor="add-hp">{system.primaryLabel} max</label>
                <input
                  id="add-hp"
                  type="number"
                  min={1}
                  value={hpMax}
                  onChange={(event) => setHpMax(event.target.value)}
                />
              </div>
              {secondaryLabel ? (
                <div className="field">
                  <label htmlFor="add-secondary">{secondaryLabel} max</label>
                  <input
                    id="add-secondary"
                    type="number"
                    min={0}
                    value={secondaryMax}
                    onChange={(event) => setSecondaryMax(event.target.value)}
                  />
                </div>
              ) : null}
              {system.showResolve ? (
                <div className="field">
                  <label htmlFor="add-resolve">Resolve</label>
                  <input
                    id="add-resolve"
                    type="number"
                    min={0}
                    value={resolve}
                    onChange={(event) => setResolve(event.target.value)}
                  />
                </div>
              ) : null}
            </>
          )}

          <div className="field field-qty">
            <label htmlFor="add-qty">Qty</label>
            <input
              id="add-qty"
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
        </div>

        <div className="add-footer">
          <button type="submit" className="btn primary">
            <span aria-hidden="true">+</span> {addLabel}
          </button>
          <span className="muted">
            {isBt
              ? 'Units on the same side share a 2d6 initiative roll.'
              : 'Set quantity to add numbered copies of a monster.'}
          </span>
        </div>
      </form>
    </section>
  );
}
