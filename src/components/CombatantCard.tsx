import { useEffect, useState } from 'react';
import type { BtLocationId, Combatant, CustomStat } from '../types';
import { useStore } from '../state/store';
import { healthState } from '../lib/hp';
import { activeSide as battletechActiveSide } from '../lib/battletech';
import {
  BT_HEAT_SHUTDOWN,
  BT_LOCATION_IDS,
  BT_LOCATION_INFO,
  repairBtDamage,
} from '../lib/mech';
import { TrackRow } from './TrackRow';
import { ConditionEditor } from './ConditionEditor';
import { CommitNumberInput } from './CommitNumberInput';
import { GatorCalculator } from './GatorCalculator';
import { HeatBar, MechDamagePanel, MechLimitsEditor } from './MechDamagePanel';
import { SAVE_KEYS, SAVE_INFO } from '../data/saves';
import { gatorBreakdown } from '../lib/gator';

const ROLE_LABELS: Record<Combatant['role'], string> = {
  pc: 'PC',
  monster: 'Monster',
  npc: 'NPC',
};

const DISPOSITION_LABELS: Record<Combatant['disposition'], string> = {
  friendly: 'Friendly',
  neutral: 'Neutral',
  unfriendly: 'Unfriendly',
};

function nextDisposition(
  disposition: Combatant['disposition'],
): Combatant['disposition'] {
  if (disposition === 'friendly') return 'neutral';
  if (disposition === 'neutral') return 'unfriendly';
  return 'friendly';
}

interface PipsProps {
  label: string;
  value: number;
  max: number;
  tone: 'good' | 'danger';
  onChange: (value: number) => void;
}

function Pips({ label, value, max, tone, onChange }: PipsProps) {
  return (
    <div className={`pips pips-${tone}`}>
      <span className="mini-label">{label}</span>
      <div className="pip-row">
        {Array.from({ length: max }, (_, index) => {
          const pipValue = index + 1;
          return (
            <button
              key={pipValue}
              type="button"
              className={`pip ${pipValue <= value ? 'is-filled' : ''}`}
              aria-label={`${label}: ${pipValue} of ${max}`}
              aria-pressed={pipValue <= value}
              onClick={() => onChange(value === pipValue ? pipValue - 1 : pipValue)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface AcStatProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Lowest value the cell accepts; saving throws may be negative. */
  min?: number;
  /** Extra classes merged onto the cell (e.g. to add spacing). */
  className?: string;
  /** Longer description used as a tooltip and accessible label. */
  title?: string;
}

/** A compact, editable armor-stat cell: AC/EAC/KAC/DR/SR (min 0) or a saving throw (may be negative). */
function AcStat({ label, value, onChange, min = 0, className, title }: AcStatProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = Math.max(min, Math.round(parsed));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className={className ? `ac-cell ${className}` : 'ac-cell'} title={title}>
      <span className="mini-label">{label}</span>
      <input
        className="ac-input"
        type="number"
        min={min}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(String(value));
            event.currentTarget.blur();
          }
        }}
        aria-label={title ?? `${label} value`}
      />
    </div>
  );
}

interface AcShieldProps {
  ac: number;
  shield: number;
  onAcChange: (value: number) => void;
  onShieldChange: (value: number) => void;
}

/** PF2e: a combined AC cell with an inline shield bonus, both editable (min 0). */
function AcShield({ ac, shield, onAcChange, onShieldChange }: AcShieldProps) {
  const [acDraft, setAcDraft] = useState(String(ac));
  const [shieldDraft, setShieldDraft] = useState(String(shield));

  useEffect(() => setAcDraft(String(ac)), [ac]);
  useEffect(() => setShieldDraft(String(shield)), [shield]);

  const commitAc = () => {
    const parsed = Number.parseInt(acDraft, 10);
    if (!Number.isFinite(parsed)) {
      setAcDraft(String(ac));
      return;
    }
    const next = Math.max(0, Math.round(parsed));
    setAcDraft(String(next));
    if (next !== ac) onAcChange(next);
  };

  const commitShield = () => {
    const parsed = Number.parseInt(shieldDraft, 10);
    if (!Number.isFinite(parsed)) {
      setShieldDraft(String(shield));
      return;
    }
    const next = Math.max(0, Math.round(parsed));
    setShieldDraft(String(next));
    if (next !== shield) onShieldChange(next);
  };

  return (
    <div className="ac-cell ac-shield" title="Armor Class (shield bonus included)">
      <span className="mini-label">AC</span>
      <input
        className="ac-input"
        type="number"
        min={0}
        value={acDraft}
        onChange={(event) => setAcDraft(event.target.value)}
        onBlur={commitAc}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setAcDraft(String(ac));
            event.currentTarget.blur();
          }
        }}
        aria-label="Armor Class"
      />
      <span className="shield-row">
        <span className="shield-glyph" aria-hidden="true">🛡</span>
        <input
          className="ac-input ac-input--shield"
          type="number"
          min={0}
          value={shieldDraft}
          onChange={(event) => setShieldDraft(event.target.value)}
          onBlur={commitShield}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setShieldDraft(String(shield));
              event.currentTarget.blur();
            }
          }}
          aria-label="Shield"
        />
      </span>
    </div>
  );
}

function CustomStatField({
  stat,
  onCommit,
}: {
  stat: CustomStat;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(stat.value);

  useEffect(() => setDraft(stat.value), [stat.value]);

  const commit = () => {
    if (draft !== stat.value) onCommit(draft);
  };

  return (
    <label className="custom-stat-row">
      <span className="custom-stat-label" title={stat.label}>
        {stat.label}
      </span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(stat.value);
            event.currentTarget.blur();
          }
        }}
        placeholder="—"
        aria-label={`${stat.label} value`}
      />
    </label>
  );
}

export function CombatantCard({ combatant }: { combatant: Combatant }) {
  const {
    system,
    encounter,
    activeCombatant,
    updateCombatant,
    removeCombatant,
    duplicateCombatantById,
    toggleDefeated,
    setActiveCombatant,
    setInitiative,
    rollInitiativeFor,
    damage,
    heal,
    damageLocation,
    healLocation,
    setLocationMax,
    setLocationCurrent,
    adjustPool,
    setPool,
    setTempHp,
    removeCondition,
    setSide,
    setHeat,
    setPilotHits,
    activateBtUnit,
  } = useStore();

  const [expanded, setExpanded] = useState(false);
  const [nameDraft, setNameDraft] = useState(combatant.name);
  const [notesDraft, setNotesDraft] = useState(combatant.notes);
  const [initDraft, setInitDraft] = useState(
    combatant.initiative === null ? '' : String(combatant.initiative),
  );
  const [sideDraft, setSideDraft] = useState(combatant.side);
  const [customAmount, setCustomAmount] = useState('');
  const [monitor, setMonitor] = useState<'hp' | 'secondary'>('hp');
  const [btLocation, setBtLocation] = useState<BtLocationId>('centerTorso');

  const isBt = system.showBattletech;
  const isActive = activeCombatant?.id === combatant.id;
  const btSide = isBt ? battletechActiveSide(encounter) : null;
  const onActiveSide = isBt && btSide !== null && btSide === (combatant.side.trim() || 'Unassigned');
  const canActivate = onActiveSide && !combatant.defeated && !combatant.acted;
  const secondaryLabel = system.secondaryLabel;
  const showSecondary =
    Boolean(secondaryLabel) &&
    (combatant.secondary.max > 0 ||
      system.id === 'starfinder1e' ||
      system.id === 'shadowrun');
  const collapsedStats = combatant.customStats.filter((stat) => stat.showInCollapsed);

  useEffect(() => setNameDraft(combatant.name), [combatant.name]);
  useEffect(() => setNotesDraft(combatant.notes), [combatant.notes]);
  useEffect(
    () => setInitDraft(combatant.initiative === null ? '' : String(combatant.initiative)),
    [combatant.initiative],
  );
  useEffect(() => setSideDraft(combatant.side), [combatant.side]);

  const commitName = () => {
    const next = nameDraft.trim();
    if (!next) {
      setNameDraft(combatant.name);
      return;
    }
    if (next !== combatant.name) updateCombatant(combatant.id, { name: next });
  };

  const commitNotes = () => {
    if (notesDraft !== combatant.notes) updateCombatant(combatant.id, { notes: notesDraft });
  };

  const commitInit = () => {
    const text = initDraft.trim();
    if (text === '') {
      if (combatant.initiative !== null) setInitiative(combatant.id, null);
      return;
    }
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      setInitDraft(combatant.initiative === null ? '' : String(combatant.initiative));
      return;
    }
    if (Math.round(parsed) !== combatant.initiative) {
      setInitiative(combatant.id, Math.round(parsed));
    }
  };

  const commitSide = () => {
    const next = sideDraft.trim() || 'Unassigned';
    if (next !== combatant.side) setSide(combatant.id, next);
  };

  const status = (() => {
    if (isBt) {
      if (combatant.defeated) return { label: 'Destroyed', tone: 'danger' };
      if (
        combatant.structure.max > 0 &&
        combatant.structure.current <= Math.ceil(combatant.structure.max / 2)
      ) {
        return { label: 'Crippled', tone: 'warn' };
      }
      if (combatant.armor.current === 0 && combatant.armor.max > 0) {
        return { label: 'Armor gone', tone: 'warn' };
      }
      return null;
    }
    if (combatant.defeated) return { label: 'Dead', tone: 'danger' };
    const health = healthState(combatant);
    if (health === 'down') return { label: 'Down', tone: 'danger' };
    if (health === 'bloodied') return { label: 'Bloodied', tone: 'warn' };
    return null;
  })();

  const applyCustom = (sign: 1 | -1) => {
    const amount = Math.max(1, Math.abs(Number.parseInt(customAmount, 10)) || 5);
    if (sign === -1) {
      if (isBt) {
        damageLocation(combatant.id, btLocation, amount);
      } else if (system.id === 'shadowrun') {
        adjustPool(combatant.id, monitor, -amount);
      } else {
        damage(combatant.id, amount);
      }
      return;
    }

    if (isBt) {
      healLocation(combatant.id, btLocation, amount);
    } else if (system.id === 'shadowrun') {
      adjustPool(combatant.id, monitor, amount);
    } else {
      heal(combatant.id, amount);
    }
  };

  const primaryDamage = (amount: number) => {
    if (system.id === 'shadowrun') adjustPool(combatant.id, 'hp', -amount);
    else damage(combatant.id, amount);
  };

  const primaryHeal = (amount: number) => {
    if (system.id === 'shadowrun') adjustPool(combatant.id, 'hp', amount);
    else heal(combatant.id, amount);
  };

  const restoreAll = () => {
    if (isBt) {
      updateCombatant(combatant.id, repairBtDamage);
      return;
    }
    setPool(combatant.id, 'hp', combatant.hp.max);
    if (showSecondary) setPool(combatant.id, 'secondary', combatant.secondary.max);
  };

  const classes = ['combatant'];
  if (isActive) classes.push('is-active');
  if (onActiveSide) classes.push('side-active');
  if (combatant.defeated) classes.push('is-defeated');
  if (expanded) classes.push('is-open');
  classes.push(`role-${combatant.role}`);
  classes.push(`disposition-${combatant.disposition}`);

  const heatWarning = combatant.heat >= BT_HEAT_SHUTDOWN;

  return (
    <article className={classes.join(' ')} aria-label={`${combatant.name}, ${ROLE_LABELS[combatant.role]}`}>
      <div className="c-main">
        {isBt ? (
          <div className={`init-block bt-init ${onActiveSide ? 'is-live' : ''}`}>
            <span className="bt-glyph" aria-hidden="true">
              {combatant.defeated ? '✕' : combatant.acted ? '✓' : '◆'}
            </span>
            <span className="eyebrow">{combatant.acted ? 'Acted' : 'Unit'}</span>
          </div>
        ) : (
          <div className={`init-block ${isActive ? 'is-live' : ''}`}>
            <input
              className="init-input"
              type="number"
              value={initDraft}
              onChange={(event) => setInitDraft(event.target.value)}
              onBlur={commitInit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  setInitDraft(combatant.initiative === null ? '' : String(combatant.initiative));
                  event.currentTarget.blur();
                }
              }}
              aria-label={`${combatant.name} initiative`}
              placeholder="—"
            />
            <button
              type="button"
              className="init-roll"
              onClick={() => rollInitiativeFor(combatant.id)}
              title="Roll initiative"
              aria-label={`Roll initiative for ${combatant.name}`}
            >
              d20
            </button>
          </div>
        )}

        <div className="c-identity">
          <div className="c-name-row">
            <input
              className="name-input"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  setNameDraft(combatant.name);
                  event.currentTarget.blur();
                }
              }}
              aria-label="Combatant name"
            />
            <span className={`role-badge role-${combatant.role}`}>{ROLE_LABELS[combatant.role]}</span>
            <button
              type="button"
              className={`disposition-tag ${combatant.disposition}`}
              onClick={() =>
                updateCombatant(combatant.id, {
                  disposition: nextDisposition(combatant.disposition),
                })
              }
              title={`${DISPOSITION_LABELS[combatant.disposition]} — click to mark ${
                DISPOSITION_LABELS[nextDisposition(combatant.disposition)].toLowerCase()
              }`}
              aria-label={`${DISPOSITION_LABELS[combatant.disposition]}. Click to mark ${
                DISPOSITION_LABELS[nextDisposition(combatant.disposition)].toLowerCase()
              }.`}
            >
              {DISPOSITION_LABELS[combatant.disposition]}
            </button>
            {isBt ? <span className="side-badge">{combatant.side || 'Unassigned'}</span> : null}
            {isActive ? <span className="active-pill">Active</span> : null}
            {combatant.acted && isBt ? <span className="acted-pill">Acted</span> : null}
            {status ? <span className={`status-badge ${status.tone}`}>{status.label}</span> : null}
          </div>

          <div className="chip-row">
            {combatant.conditions.map((condition) => (
              <button
                type="button"
                key={condition.id}
                className="chip condition-chip"
                onClick={() => removeCondition(combatant.id, condition.id)}
                title={`Remove ${condition.label}`}
              >
                {condition.label}
                {condition.rounds !== null ? <span className="chip-rounds">{condition.rounds}r</span> : null}
                <span className="chip-x" aria-hidden="true">
                  ×
                </span>
              </button>
            ))}
            <button
              type="button"
              className="chip chip-add"
              onClick={() => setExpanded(true)}
              title="Add a condition"
            >
              + condition
            </button>
            {!isBt && system.showDeathSaves && combatant.hp.current <= 0 ? (
              <span className="inline-warning">
                Death saves {combatant.deathSaves.successes}✓ / {combatant.deathSaves.failures}✗
              </span>
            ) : null}
          </div>
        </div>

        <div className="c-actions">
          {canActivate ? (
            <button
              type="button"
              className="btn small primary"
              onClick={() => activateBtUnit(combatant.id)}
              title="Activate this unit and pass to the next side"
            >
              Activate
            </button>
          ) : null}
          {!isBt && !isActive && !combatant.defeated ? (
            <button
              type="button"
              className="icon-btn"
              onClick={() => setActiveCombatant(combatant.id)}
              title="Make active"
              aria-label="Make active"
            >
              ▸
            </button>
          ) : null}
          <button
            type="button"
            className="icon-btn dead-toggle"
            onClick={() => toggleDefeated(combatant.id)}
            title={isBt ? 'Mark destroyed' : 'Mark dead'}
            aria-label={isBt ? 'Mark destroyed' : 'Mark dead'}
            aria-pressed={combatant.defeated}
          >
            ☠
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            title={expanded ? 'Collapse details' : 'Expand details'}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      <div className="c-tracks">
        {isBt ? (
          <>
            <div className="track-pair">
              <TrackRow
                label="Armor (total)"
                track={combatant.armor}
                tone="armor"
                hint="Total armor remaining across every location. Expand the card to edit the locations."
              />
              <TrackRow
                label="Structure (total)"
                track={combatant.structure}
                tone="structure"
                hint="Total internal structure remaining. Destroying the head or center torso destroys the unit. Expand the card to edit the locations."
              />
            </div>
            <HeatBar
              heat={combatant.heat}
              onChange={(heat) => setHeat(combatant.id, heat)}
            />
            <div className="bt-summary">
              <span className={`bt-stat ${combatant.pilotHits >= 3 ? 'warn' : ''}`}>
                Pilot <strong>{combatant.pilotHits}</strong>/6
              </span>
              <span className="bt-stat">
                Gunnery <strong>{combatant.gunnery}</strong>
              </span>
              <span className="bt-stat">
                Piloting <strong>{combatant.piloting}</strong>
              </span>
              <span className="bt-stat bt-gator-total">
                Attack DC <strong>{gatorBreakdown(combatant).total}</strong>
              </span>
            </div>
          </>
        ) : (
          <>
            {(system.id === 'dnd5e' ||
              system.id === 'starfinder1e' ||
              system.id === 'starfinder2e') ? (
              <div className="ac-row">
                {system.id === 'dnd5e' ? (
                  <>
                    <AcStat
                      label="AC"
                      value={combatant.ac}
                      title="Armor Class"
                      onChange={(next) => updateCombatant(combatant.id, { ac: next })}
                    />
                    <span className="ac-row-label">Saves</span>
                    {SAVE_KEYS.map((key) => (
                      <AcStat
                        key={key}
                        label={SAVE_INFO[key].label}
                        title={SAVE_INFO[key].title}
                        value={combatant.saves[key]}
                        min={-99}
                        onChange={(next) =>
                          updateCombatant(combatant.id, (current) => ({
                            ...current,
                            saves: { ...current.saves, [key]: next },
                          }))
                        }
                      />
                    ))}
                  </>
                ) : system.id === 'starfinder1e' ? (
                  <>
                    <AcStat
                      label="EAC"
                      value={combatant.eac}
                      onChange={(next) => updateCombatant(combatant.id, { eac: next })}
                    />
                    <AcStat
                      label="KAC"
                      value={combatant.kac}
                      onChange={(next) => updateCombatant(combatant.id, { kac: next })}
                    />
                    <AcStat
                      label="Fort"
                      value={combatant.fort}
                      min={-99}
                      className="ac-sep"
                      onChange={(next) => updateCombatant(combatant.id, { fort: next })}
                    />
                    <AcStat
                      label="Reflex"
                      value={combatant.reflex}
                      min={-99}
                      onChange={(next) => updateCombatant(combatant.id, { reflex: next })}
                    />
                    <AcStat
                      label="Con"
                      value={combatant.con}
                      min={-99}
                      onChange={(next) => updateCombatant(combatant.id, { con: next })}
                    />
                    <AcStat
                      label="DR"
                      value={combatant.dr}
                      className="ac-sep"
                      onChange={(next) => updateCombatant(combatant.id, { dr: next })}
                    />
                    <AcStat
                      label="SR"
                      value={combatant.sr}
                      onChange={(next) => updateCombatant(combatant.id, { sr: next })}
                    />
                    <AcStat
                      label="CR"
                      value={combatant.cr}
                      className="ac-sep"
                      title="Combatant Rating"
                      onChange={(next) => updateCombatant(combatant.id, { cr: next })}
                    />
                    <AcStat
                      label="Spell DC"
                      value={combatant.spellDC}
                      title="Spell save DC"
                      onChange={(next) => updateCombatant(combatant.id, { spellDC: next })}
                    />
                  </>
                ) : (
                  <>
                    <AcShield
                      ac={combatant.ac}
                      shield={combatant.shield}
                      onAcChange={(next) => updateCombatant(combatant.id, { ac: next })}
                      onShieldChange={(next) => updateCombatant(combatant.id, { shield: next })}
                    />
                    <span className="ac-row-label">Saves</span>
                    <AcStat
                      label="Fort"
                      value={combatant.fort}
                      min={-99}
                      title="Fortitude saving throw"
                      onChange={(next) => updateCombatant(combatant.id, { fort: next })}
                    />
                    <AcStat
                      label="Reflex"
                      value={combatant.reflex}
                      min={-99}
                      title="Reflex saving throw"
                      onChange={(next) => updateCombatant(combatant.id, { reflex: next })}
                    />
                    <AcStat
                      label="Con"
                      value={combatant.con}
                      min={-99}
                      title="Constitution saving throw"
                      onChange={(next) => updateCombatant(combatant.id, { con: next })}
                    />
                    <AcStat
                      label="CR"
                      value={combatant.cr}
                      className="ac-sep"
                      title="Combatant Rating"
                      onChange={(next) => updateCombatant(combatant.id, { cr: next })}
                    />
                    <AcStat
                      label="Spell DC"
                      value={combatant.spellDC}
                      title="Spell save DC"
                      onChange={(next) => updateCombatant(combatant.id, { spellDC: next })}
                    />
                  </>
                )}
              </div>
            ) : null}
            <div className="track-pair">
              <TrackRow
                label={system.primaryLabel}
              track={combatant.hp}
              tone="hp"
              showTemp={system.showTempHp}
              onDamage={primaryDamage}
              onHeal={primaryHeal}
              hint={
                system.id === 'starfinder1e'
                  ? 'Damage drains Stamina before HP.'
                  : system.id === 'shadowrun'
                    ? 'Physical condition monitor.'
                    : undefined
              }
            />
            {showSecondary && secondaryLabel ? (
              <TrackRow
                label={secondaryLabel}
                track={combatant.secondary}
                tone="secondary"
                onDamage={(amount) => adjustPool(combatant.id, 'secondary', -amount)}
                onHeal={(amount) => adjustPool(combatant.id, 'secondary', amount)}
                hint={
                  system.id === 'starfinder1e'
                    ? 'Stamina absorbs damage before HP.'
                    : system.id === 'shadowrun'
                      ? 'Stun condition monitor.'
                      : undefined
                }
              />
            ) : null}
          </div>
          </>
        )}
        {collapsedStats.length > 0 ? (
          <div className="custom-stat-summary">
            {collapsedStats.map((stat) => (
              <span className="custom-stat-chip" key={stat.id}>
                <span>{stat.label}</span>
                <strong>{stat.value || '—'}</strong>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div className="c-expanded">
          <div className="expand-grid">
            <div className="field field-notes">
              <label htmlFor={`notes-${combatant.id}`}>Notes</label>
              <textarea
                id={`notes-${combatant.id}`}
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                onBlur={commitNotes}
                placeholder="Resistances, tactics, ammo, reminders…"
                rows={3}
              />
            </div>

            <div className="expand-controls">
              <div className="control-row">
                <span className="mini-label">Custom</span>
                <input
                  className="amount-input"
                  type="number"
                  min={1}
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  placeholder="5"
                  aria-label="Custom amount"
                />
                {isBt ? (
                  <select
                    className="select small-select"
                    value={btLocation}
                    onChange={(event) =>
                      setBtLocation(event.target.value as BtLocationId)
                    }
                    aria-label="Hit location"
                  >
                    {BT_LOCATION_IDS.map((id) => (
                      <option key={id} value={id}>
                        {BT_LOCATION_INFO[id].label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {system.id === 'shadowrun' ? (
                  <select
                    className="select small-select"
                    value={monitor}
                    onChange={(event) => setMonitor(event.target.value as 'hp' | 'secondary')}
                    aria-label="Condition monitor"
                  >
                    <option value="hp">Physical</option>
                    <option value="secondary">Stun</option>
                  </select>
                ) : null}
                <button type="button" className="btn small" onClick={() => applyCustom(-1)}>
                  Damage
                </button>
                <button type="button" className="btn small" onClick={() => applyCustom(1)}>
                  Heal
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={restoreAll}
                  title="Restore HP, Stamina and armor/structure to full"
                  aria-label="Restore health monitors to full"
                >
                  Restore
                </button>
              </div>

              {system.showTempHp ? (
                <label className="mini-field">
                  Temp HP
                  <CommitNumberInput
                    min={0}
                    value={combatant.hp.temp}
                    label="Temporary hit points"
                    onCommit={(temp) => setTempHp(combatant.id, temp)}
                  />
                </label>
              ) : null}

              {system.showResolve ? (
                <label className="mini-field">
                  Resolve Points
                  <CommitNumberInput
                    min={0}
                    value={combatant.resolve}
                    label="Resolve points"
                    onCommit={(resolve) => updateCombatant(combatant.id, { resolve })}
                  />
                </label>
              ) : null}

              {!isBt ? (
                <div className="mini-grid">
                  <label className="mini-field">
                    Init mod
                    <CommitNumberInput
                      value={combatant.initMod}
                      label="Initiative modifier"
                      onCommit={(initMod) => updateCombatant(combatant.id, { initMod })}
                    />
                  </label>
                  <label className="mini-field">
                    Tiebreak
                    <CommitNumberInput
                      value={combatant.tiebreak}
                      label="Tiebreak modifier"
                      onCommit={(tiebreak) => updateCombatant(combatant.id, { tiebreak })}
                    />
                  </label>
                </div>
              ) : null}

              {system.id === 'starfinder1e' ? (
                <>
                  {combatant.role === 'monster' ? (
                    <label className="mini-field">
                      HP Regen
                      <CommitNumberInput
                        min={0}
                        value={combatant.regen}
                        label="HP regeneration"
                        onCommit={(value) => updateCombatant(combatant.id, { regen: value })}
                      />
                    </label>
                  ) : null}
                </>
              ) : null}

              {isBt ? (
                <>
                  <label className="mini-field">
                    Side
                    <input
                      value={sideDraft}
                      onChange={(event) => setSideDraft(event.target.value)}
                      onBlur={commitSide}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                        if (event.key === 'Escape') {
                          setSideDraft(combatant.side);
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  </label>
                  <div className="control-row">
                    <span className="mini-label">Heat</span>
                    <span className={`heat-value ${heatWarning ? 'warn' : ''}`}>{combatant.heat}</span>
                    <button
                      type="button"
                      className="qbtn"
                      onClick={() => setHeat(combatant.id, combatant.heat - 5)}
                    >
                      −5
                    </button>
                    <button
                      type="button"
                      className="qbtn"
                      onClick={() => setHeat(combatant.id, combatant.heat - 1)}
                    >
                      −1
                    </button>
                    <button
                      type="button"
                      className="qbtn"
                      onClick={() => setHeat(combatant.id, combatant.heat + 1)}
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      className="qbtn"
                      onClick={() => setHeat(combatant.id, combatant.heat + 5)}
                    >
                      +5
                    </button>
                  </div>
                  <Pips
                    label="Pilot hits"
                    value={combatant.pilotHits}
                    max={6}
                    tone="danger"
                    onChange={(value) => setPilotHits(combatant.id, value)}
                  />
                </>
              ) : null}

              {system.showDeathSaves ? (
                <div className="death-saves">
                  <Pips
                    label="Death saves ✓"
                    value={combatant.deathSaves.successes}
                    max={3}
                    tone="good"
                    onChange={(value) =>
                      updateCombatant(combatant.id, (current) => ({
                        ...current,
                        deathSaves: { ...current.deathSaves, successes: value },
                      }))
                    }
                  />
                  <Pips
                    label="Death saves ✗"
                    value={combatant.deathSaves.failures}
                    max={3}
                    tone="danger"
                    onChange={(value) =>
                      updateCombatant(combatant.id, (current) => ({
                        ...current,
                        deathSaves: { ...current.deathSaves, failures: value },
                      }))
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>

          {isBt ? (
            <div className="expanded-section">
              <div className="section-head">
                <h4>Hit locations</h4>
                <span className="muted">
                  Set armor/structure directly, or use ± to apply damage with transfer.
                </span>
              </div>
              <div className="mech-limit-panel">
                <MechLimitsEditor
                  combatant={combatant}
                  onMaxChange={(locationIds, pool, max) =>
                    setLocationMax(combatant.id, locationIds, pool, max)
                  }
                />
                <MechDamagePanel
                  combatant={combatant}
                  onDamage={(location, amount) =>
                    damageLocation(combatant.id, location, amount)
                  }
                  onHeal={(location, amount) =>
                    healLocation(combatant.id, location, amount)
                  }
                  onSetCurrent={(location, pool, current) =>
                    setLocationCurrent(combatant.id, location, pool, current)
                  }
                />
              </div>
            </div>
          ) : null}

          {isBt ? <GatorCalculator combatant={combatant} /> : null}

          <div className="expanded-section">
            <div className="section-head">
              <h4>Conditions</h4>
              <span className="muted">Duration ticks down when a round ends.</span>
            </div>
            <div className="chip-row">
              {combatant.conditions.length === 0 ? (
                <span className="muted">No conditions.</span>
              ) : (
                combatant.conditions.map((condition) => (
                  <button
                    type="button"
                    key={condition.id}
                    className="chip condition-chip"
                    onClick={() => removeCondition(combatant.id, condition.id)}
                    title={`Remove ${condition.label}`}
                  >
                    {condition.label}
                    {condition.rounds !== null ? (
                      <span className="chip-rounds">{condition.rounds}r</span>
                    ) : null}
                    <span className="chip-x" aria-hidden="true">
                      ×
                    </span>
                  </button>
                ))
              )}
            </div>
            <ConditionEditor combatantId={combatant.id} presets={system.conditions} />
          </div>

          {combatant.customStats.length > 0 ? (
            <div className="expanded-section">
              <div className="section-head">
                <h4>Custom stats</h4>
                <span className="muted">Values apply to this combatant only.</span>
              </div>
              <div className="custom-stat-list">
                {combatant.customStats.map((stat) => (
                  <CustomStatField
                    key={stat.id}
                    stat={stat}
                    onCommit={(value) =>
                      updateCombatant(combatant.id, (current) => ({
                        ...current,
                        customStats: current.customStats.map((entry) =>
                          entry.id === stat.id ? { ...entry, value } : entry,
                        ),
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="card-footer">
            <button
              type="button"
              className="btn small"
              onClick={() => duplicateCombatantById(combatant.id)}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => toggleDefeated(combatant.id)}
            >
              {combatant.defeated ? 'Revive' : isBt ? 'Mark destroyed' : 'Mark dead'}
            </button>
            <button
              type="button"
              className="btn small danger"
              onClick={() => removeCombatant(combatant.id)}
              title="Remove combatant (undo with Ctrl+Z)"
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
