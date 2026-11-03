import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useStore } from '../state/store';
import { defaultDisposition, track } from '../lib/factory';
import { rollInitiativeScore } from '../lib/dice';
import { sideNames } from '../lib/battletech';
import { defaultSaves, SAVE_KEYS, SAVE_INFO, savesToDrafts } from '../data/saves';
import type { CombatantTemplate, Disposition, Role, SavingThrows } from '../types';

const ROLE_LABELS: Record<Role, string> = {
  pc: 'PC',
  monster: 'Monster',
  npc: 'NPC',
};

const DISPOSITION_LABELS: Record<Disposition, string> = {
  friendly: 'Friendly',
  neutral: 'Neutral',
  unfriendly: 'Unfriendly',
};

const DISPOSITION_HINTS: Record<Disposition, string> = {
  friendly: 'Allies and friendly characters',
  neutral: 'Bystanders and characters who are neither ally nor enemy',
  unfriendly: 'Hostile creatures and monsters',
};

const ROLE_ORDER: Record<Role, number> = { pc: 0, npc: 1, monster: 2 };

/** Sort the name-field dropdown: PCs first, then NPCs, then monsters, A–Z. */
function compareTemplates(a: CombatantTemplate, b: CombatantTemplate): number {
  const byRole = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
  if (byRole !== 0) return byRole;
  return a.name.localeCompare(b.name);
}

function toInt(value: string, fallback = 0): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function AddCombatant() {
  const { system, encounter, templates, addCombatants } = useStore();
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('monster');
  const [disposition, setDisposition] = useState<Disposition>('unfriendly');
  const [side, setSide] = useState('OpFor');
  const [initMod, setInitMod] = useState('0');
  const [score, setScore] = useState('');
  const [autoRoll, setAutoRoll] = useState(true);
  const [hpMax, setHpMax] = useState('10');
  const [secondaryMax, setSecondaryMax] = useState('10');
  const [resolve, setResolve] = useState('3');
  const [armor, setArmor] = useState('10');
  const [structure, setStructure] = useState('5');
  const [ac, setAc] = useState('10');
  const [eac, setEac] = useState('10');
  const [kac, setKac] = useState('10');
  const [dr, setDr] = useState('0');
  const [sr, setSr] = useState('0');
  const [fort, setFort] = useState('0');
  const [reflex, setReflex] = useState('0');
  const [con, setCon] = useState('0');
  const [shield, setShield] = useState('0');
  const [saveDrafts, setSaveDrafts] = useState(() => savesToDrafts());
  const [regen, setRegen] = useState('0');
  const [cr, setCr] = useState('0');
  const [spellDC, setSpellDC] = useState('0');
  const [quantity, setQuantity] = useState('1');
  const nameRef = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  const isBt = system.showBattletech;
  const secondaryLabel = system.secondaryLabel;

  useEffect(() => {
    if (system.id === 'shadowrun') {
      setHpMax('10');
      setSecondaryMax('10');
    } else if (system.id === 'starfinder1e' || system.id === 'starfinder2e') {
      setHpMax('10');
      setSecondaryMax('10');
      setDr('0');
      setSr('0');
      setFort('0');
      setReflex('0');
      setCon('0');
      setShield('0');
      setRegen('0');
      setCr('0');
      setSpellDC('0');
    } else {
      setSecondaryMax('5');
    }
    if (isBt) {
      setArmor('10');
      setStructure('5');
      setSide((current) => (current === 'Players' || !current ? 'OpFor' : current));
    }
    setAc('10');
    setEac('10');
    setKac('10');
    setSaveDrafts(savesToDrafts());
  }, [system.id, isBt]);

  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() !== 'a' || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      setCollapsed(false);
      requestAnimationFrame(() => {
        nameRef.current?.focus();
        nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    };
    window.addEventListener('keydown', focus);
    return () => window.removeEventListener('keydown', focus);
  }, []);

  const pickRole = (next: Role) => {
    setRole(next);
    setDisposition(defaultDisposition(next));
    setSide(next === 'pc' ? 'Players' : 'OpFor');
  };

  const loadTemplate = useCallback((template: CombatantTemplate) => {
    setName(template.name);
    setRole(template.role);
    setDisposition(template.disposition);
    setSide(template.side);
    setInitMod(String(template.initMod));
    setHpMax(String(template.hpMax));
    setSecondaryMax(String(template.secondaryMax));
    setResolve(String(template.resolve));
    setArmor(String(template.armor));
    setStructure(String(template.structure));
    setAc(String(template.ac));
    setEac(String(template.eac));
    setKac(String(template.kac));
    setSaveDrafts(savesToDrafts(template.saves));
    setDr(String(template.dr));
    setSr(String(template.sr));
    setFort(String(template.fort));
    setReflex(String(template.reflex));
    setCon(String(template.con));
    setRegen(String(template.regen));
    setCr(String(template.cr));
    setSpellDC(String(template.spellDC));
    setQuantity('1');
  }, []);

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
    const acValue = Math.max(0, toInt(ac, 0));
    const eacValue = Math.max(0, toInt(eac, 0));
    const kacValue = Math.max(0, toInt(kac, 0));
    const shieldValue = Math.max(0, toInt(shield, 0));
    const saveValues = Object.fromEntries(
      SAVE_KEYS.map((key) => [key, toInt(saveDrafts[key], 0)]),
    ) as SavingThrows;
    const drValue = Math.max(0, toInt(dr, 0));
    const srValue = Math.max(0, toInt(sr, 0));
    const fortValue = toInt(fort, 0);
    const reflexValue = toInt(reflex, 0);
    const conValue = toInt(con, 0);
    const regenValue = Math.max(0, toInt(regen, 0));
    const crValue = Math.max(0, toInt(cr, 0));
    const spellDCValue = Math.max(0, toInt(spellDC, 0));

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
        disposition,
        side: isBt ? side.trim() || (role === 'pc' ? 'Players' : 'OpFor') : role === 'pc' ? 'Players' : 'OpFor',
        initiative,
        initMod: modifier,
        tiebreak: modifier,
        hp: track(isBt ? 0 : hpValue),
        secondary: track(isBt || !secondaryLabel ? 0 : secondaryValue),
        resolve: system.showResolve ? resolveValue : 0,
        armor: track(isBt ? armorValue : 0),
        structure: track(isBt ? structureValue : 0),
        ac: acValue,
        eac: eacValue,
        kac: kacValue,
        shield: shieldValue,
        saves: saveValues,
        dr: drValue,
        sr: srValue,
        fort: fortValue,
        reflex: reflexValue,
        con: conValue,
        regen: regenValue,
        cr: crValue,
        spellDC: spellDCValue,
      };
    });

    const template: CombatantTemplate = {
      name: baseName,
      role,
      disposition,
      side: isBt ? side.trim() || (role === 'pc' ? 'Players' : 'OpFor') : role === 'pc' ? 'Players' : 'OpFor',
      initMod: modifier,
      tiebreak: modifier,
      hpMax: hpValue,
      secondaryMax: secondaryValue,
      resolve: resolveValue,
      armor: armorValue,
      structure: structureValue,
      ac: acValue,
      eac: eacValue,
      kac: kacValue,
      shield: shieldValue,
      saves: saveValues,
      dr: drValue,
      sr: srValue,
      fort: fortValue,
      reflex: reflexValue,
      con: conValue,
      regen: regenValue,
      cr: crValue,
      spellDC: spellDCValue,
    };

    addCombatants(drafts, template);
    setName('');
    setScore('');
    nameRef.current?.focus();
  };

  const sides = sideNames(encounter);
  const addLabel = `Add ${toInt(quantity, 1) > 1 ? `${toInt(quantity, 1)} combatants` : 'combatant'}`;

  return (
    <section className={`panel add-panel ${collapsed ? 'add-panel--collapsed' : ''}`}>
      <div className="panel-head">
        <div>
          <h2>Add combatant</h2>
          <p className="muted">
            {isBt
              ? 'Add units to a side. Side initiative is rolled with 2d6. Units follow the tag defaults.'
              : `${system.initHint}. Defaults: PCs friendly, NPCs neutral, monsters unfriendly.`}
          </p>
        </div>
        <div className="panel-head-controls">
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
          <button
            type="button"
            className="icon-btn collapse-toggle"
            onClick={() => setCollapsed((open) => !open)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand form' : 'Collapse form'}
            title={collapsed ? 'Expand form' : 'Collapse form'}
          >
            {collapsed ? '▾' : '▸'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="add-grid">
          <div className="field field-name">
            <label htmlFor="add-name">Name</label>
            <input
              id="add-name"
              ref={nameRef}
              value={name}
              onChange={(event) => {
                const value = event.target.value;
                setName(value);
                const match = templates.find((entry) => entry.name === value);
                if (match) loadTemplate(match);
              }}
              list="combatant-library"
              placeholder={
                role === 'pc' ? 'Aria' : role === 'monster' ? 'Goblin' : 'Innkeeper'
              }
              autoComplete="off"
            />
            <datalist id="combatant-library">
              {templates
                .slice()
                .sort(compareTemplates)
                .map((entry) => (
                  <option key={`${entry.role}:${entry.name}`} value={entry.name}>
                    {ROLE_LABELS[entry.role]} {entry.name}
                  </option>
                ))}
            </datalist>
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

          <div className="field">
            <label>Tag</label>
            <div className="segmented" role="group" aria-label="Disposition">
              {(['friendly', 'neutral', 'unfriendly'] as Disposition[]).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className={`disposition-${entry} ${disposition === entry ? 'is-selected' : ''}`}
                  onClick={() => setDisposition(entry)}
                  aria-pressed={disposition === entry}
                  title={DISPOSITION_HINTS[entry]}
                >
                  {DISPOSITION_LABELS[entry]}
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

              {system.id === 'dnd5e' ? (
                <>
                  <div className="field">
                    <label htmlFor="add-ac">AC</label>
                    <input
                      id="add-ac"
                      type="number"
                      min={0}
                      value={ac}
                      onChange={(event) => setAc(event.target.value)}
                      title="Armor Class"
                    />
                  </div>
                  <div className="field save-fields">
                    <span className="field-label">Saving throws</span>
                    <div className="save-inputs">
                      {SAVE_KEYS.map((key) => (
                        <label className="save-field" key={key} title={SAVE_INFO[key].title}>
                          <span>{SAVE_INFO[key].label}</span>
                          <input
                            type="number"
                            value={saveDrafts[key]}
                            onChange={(event) =>
                              setSaveDrafts((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }))
                            }
                            aria-label={SAVE_INFO[key].title}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {system.id === 'starfinder2e' ? (
                <>
                  <div className="field">
                    <label htmlFor="add-ac">AC</label>
                    <input
                      id="add-ac"
                      type="number"
                      min={0}
                      value={ac}
                      onChange={(event) => setAc(event.target.value)}
                      title="Armor Class"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-shield">Shield</label>
                    <input
                      id="add-shield"
                      type="number"
                      min={0}
                      value={shield}
                      onChange={(event) => setShield(event.target.value)}
                      title="Shield bonus"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-fort">Fort</label>
                    <input
                      id="add-fort"
                      type="number"
                      value={fort}
                      onChange={(event) => setFort(event.target.value)}
                      title="Fortitude save"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-reflex">Reflex</label>
                    <input
                      id="add-reflex"
                      type="number"
                      value={reflex}
                      onChange={(event) => setReflex(event.target.value)}
                      title="Reflex save"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-con">Con</label>
                    <input
                      id="add-con"
                      type="number"
                      value={con}
                      onChange={(event) => setCon(event.target.value)}
                      title="Constitution save"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-cr">CR</label>
                    <input
                      id="add-cr"
                      type="number"
                      min={0}
                      value={cr}
                      onChange={(event) => setCr(event.target.value)}
                      title="Combatant Rating"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-spell-dc">Spell DC</label>
                    <input
                      id="add-spell-dc"
                      type="number"
                      min={0}
                      value={spellDC}
                      onChange={(event) => setSpellDC(event.target.value)}
                      title="Spell save DC"
                    />
                  </div>
                </>
              ) : null}

              {system.id === 'starfinder1e' ? (
                <>
                  <div className="field">
                    <label htmlFor="add-eac">EAC</label>
                    <input
                      id="add-eac"
                      type="number"
                      min={0}
                      value={eac}
                      onChange={(event) => setEac(event.target.value)}
                      title="Energy Armor Class"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-kac">KAC</label>
                    <input
                      id="add-kac"
                      type="number"
                      min={0}
                      value={kac}
                      onChange={(event) => setKac(event.target.value)}
                      title="Kinetic Armor Class"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-dr">DR</label>
                    <input
                      id="add-dr"
                      type="number"
                      min={0}
                      value={dr}
                      onChange={(event) => setDr(event.target.value)}
                      title="Damage reduction"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-sr">SR</label>
                    <input
                      id="add-sr"
                      type="number"
                      min={0}
                      value={sr}
                      onChange={(event) => setSr(event.target.value)}
                      title="Spell resistance"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-cr">CR</label>
                    <input
                      id="add-cr"
                      type="number"
                      min={0}
                      value={cr}
                      onChange={(event) => setCr(event.target.value)}
                      title="Combatant Rating"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-spell-dc">Spell DC</label>
                    <input
                      id="add-spell-dc"
                      type="number"
                      min={0}
                      value={spellDC}
                      onChange={(event) => setSpellDC(event.target.value)}
                      title="Spell save DC"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-fort">Fort</label>
                    <input
                      id="add-fort"
                      type="number"
                      value={fort}
                      onChange={(event) => setFort(event.target.value)}
                      title="Fortitude save"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-reflex">Reflex</label>
                    <input
                      id="add-reflex"
                      type="number"
                      value={reflex}
                      onChange={(event) => setReflex(event.target.value)}
                      title="Reflex save"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-con">Con</label>
                    <input
                      id="add-con"
                      type="number"
                      value={con}
                      onChange={(event) => setCon(event.target.value)}
                      title="Constitution save"
                    />
                  </div>
                  {role === 'monster' ? (
                    <div className="field">
                      <label htmlFor="add-regen">HP Regen</label>
                      <input
                        id="add-regen"
                        type="number"
                        min={0}
                        value={regen}
                        onChange={(event) => setRegen(event.target.value)}
                        title="Heals this much HP at the start of the monster's turn"
                      />
                    </div>
                  ) : null}
                </>
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
