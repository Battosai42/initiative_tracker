import type { BtLocation, BtLocationId, Combatant } from '../types';
import {
  BT_HEAT_MAX,
  BT_HEAT_SHUTDOWN,
  BT_LOCATION_IDS,
  BT_LOCATION_INFO,
  isBtLocationDestroyed,
} from '../lib/mech';
import { CommitNumberInput } from './CommitNumberInput';
import { DeltaInput } from './TrackRow';

function barPercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (current / max) * 100));
}

function heatState(heat: number): 'ok' | 'warn' | 'critical' {
  if (heat >= BT_HEAT_SHUTDOWN) return 'critical';
  if (heat >= 8) return 'warn';
  return 'ok';
}

interface HeatBarProps {
  heat: number;
  onChange: (heat: number) => void;
}

/** Heat buildup bar for a BattleTech unit, with a 0–30 scale. */
export function HeatBar({ heat, onChange }: HeatBarProps) {
  const state = heatState(heat);
  const percent = barPercent(heat, BT_HEAT_MAX);

  return (
    <div
      className={`heat-track heat-${state}`}
      title={`Heat ${heat}. A shutdown check is required at ${BT_HEAT_SHUTDOWN}+.`}
    >
      <div className="track-head">
        <span className="track-label">Heat</span>
        <span className="track-side">
          <span className="track-numbers">
            <strong>{heat}</strong>
            <span className="track-max">/ {BT_HEAT_MAX}</span>
            {heat >= BT_HEAT_SHUTDOWN ? (
              <span className="heat-flag">shutdown check</span>
            ) : null}
          </span>
          <DeltaInput
            label="Heat"
            increaseHint="build heat"
            decreaseHint="cool"
            onApply={(delta) => onChange(heat + delta)}
          />
        </span>
      </div>
      <div
        className="bar"
        role="progressbar"
        aria-label="Heat"
        aria-valuemin={0}
        aria-valuemax={BT_HEAT_MAX}
        aria-valuenow={Math.max(0, Math.min(BT_HEAT_MAX, heat))}
      >
        <div className="bar-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function LocationPool({
  label,
  track,
  tone,
  onCurrentChange,
}: {
  label: string;
  track: BtLocation['armor'];
  tone: 'armor' | 'structure';
  onCurrentChange: (current: number) => void;
}) {
  return (
    <div className={`mech-pool mech-pool-${tone}`}>
      <div className="mech-pool-head">
        <span>{label}</span>
        <span className="mech-pool-numbers">
          <CommitNumberInput
            className="mech-pool-input"
            min={0}
            // Leave an uninitialised 0/0 pool unbounded so the spinner and
            // direct entry can raise it; the store expands the limit to match.
            max={track.max > 0 ? track.max : undefined}
            value={track.current}
            label={`${label} current value`}
            title={
              track.max > 0
                ? `Set ${label.toLowerCase()} to a value between 0 and ${track.max}`
                : `Set ${label.toLowerCase()} to assign a value and create its limit`
            }
            onCommit={onCurrentChange}
          />
          <span className="mech-pool-max">/ {track.max}</span>
        </span>
      </div>
      <div className="bar bar-thin">
        <div
          className="bar-fill"
          style={{ width: `${barPercent(track.current, track.max)}%` }}
        />
      </div>
    </div>
  );
}

function LocationCard({
  id,
  location,
  onDamage,
  onHeal,
  onSetCurrent,
}: {
  id: BtLocationId;
  location: BtLocation;
  onDamage: (id: BtLocationId, amount: number) => void;
  onHeal: (id: BtLocationId, amount: number) => void;
  onSetCurrent: (
    id: BtLocationId,
    pool: 'armor' | 'structure',
    current: number,
  ) => void;
}) {
  const info = BT_LOCATION_INFO[id];
  const destroyed = isBtLocationDestroyed(location);
  const transfer = info.transfer
    ? `Destroyed damage transfers to the ${BT_LOCATION_INFO[info.transfer].label.toLowerCase()}.`
    : 'Destroying this location destroys the unit.';

  return (
    <div
      className={`mech-location ${destroyed ? 'is-destroyed' : ''}`}
      title={`${info.label}. ${transfer}`}
    >
      <div className="mech-location-head">
        <span className="mech-location-name">{info.label}</span>
        <span className="mech-location-status">
          {destroyed ? 'Destroyed' : info.short}
        </span>
      </div>
      <LocationPool
        label="Armor"
        track={location.armor}
        tone="armor"
        onCurrentChange={(current) => onSetCurrent(id, 'armor', current)}
      />
      <LocationPool
        label="Structure"
        track={location.structure}
        tone="structure"
        onCurrentChange={(current) => onSetCurrent(id, 'structure', current)}
      />
      <div className="mech-location-actions">
        <DeltaInput
          label={`${info.label} damage`}
          onApply={(delta) =>
            delta < 0 ? onDamage(id, -delta) : onHeal(id, delta)
          }
        />
      </div>
    </div>
  );
}

interface MechDamagePanelProps {
  combatant: Combatant;
  onDamage: (id: BtLocationId, amount: number) => void;
  onHeal: (id: BtLocationId, amount: number) => void;
  onSetCurrent: (
    id: BtLocationId,
    pool: 'armor' | 'structure',
    current: number,
  ) => void;
}

/**
 * Per-location damage grid. Each segment tracks armor and structure, and
 * overflow follows the BattleTech transfer diagram when a segment is used up.
 */
export function MechDamagePanel({
  combatant,
  onDamage,
  onHeal,
  onSetCurrent,
}: MechDamagePanelProps) {
  return (
    <div className="mech-panel">
      <div className="mech-locations" role="group" aria-label="Mech hit locations">
        {BT_LOCATION_IDS.map((id) => (
          <LocationCard
            key={id}
            id={id}
            location={combatant.locations[id]}
            onDamage={onDamage}
            onHeal={onHeal}
            onSetCurrent={onSetCurrent}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Limits are edited per mirrored pair because a 'Mech's left and right sides
 * always share the same armor and structure values. Head and center torso are
 * single locations.
 */
const BT_LIMIT_GROUPS: Array<{
  label: string;
  short: string;
  ids: BtLocationId[];
}> = [
  { label: 'Head', short: 'H', ids: ['head'] },
  { label: 'Center torso', short: 'CT', ids: ['centerTorso'] },
  { label: 'Side torsos', short: 'LT / RT', ids: ['leftTorso', 'rightTorso'] },
  { label: 'Arms', short: 'LA / RA', ids: ['leftArm', 'rightArm'] },
  { label: 'Legs', short: 'LL / RL', ids: ['leftLeg', 'rightLeg'] },
];

interface MechLimitsEditorProps {
  combatant: Combatant;
  onMaxChange: (
    ids: BtLocationId[],
    pool: 'armor' | 'structure',
    max: number,
  ) => void;
}

/** Expanded-card editor for the armor/structure limits of each location. */
export function MechLimitsEditor({ combatant, onMaxChange }: MechLimitsEditorProps) {
  return (
    <div className="mech-limits">
      <div className="mech-limits-head">
        <span className="mech-limits-title">Armor &amp; structure limits</span>
        <span className="mech-limits-hint">Left and right share the same limit.</span>
      </div>
      <div className="mech-limits-grid">
        <div className="mech-limit-row mech-limit-head">
          <span className="mech-limit-name">Location</span>
          <span className="mech-limit-column">Armor</span>
          <span className="mech-limit-column">Structure</span>
        </div>
        {BT_LIMIT_GROUPS.map((group) => {
          const location = combatant.locations[group.ids[0]];
          return (
            <div className="mech-limit-row" key={group.label}>
              <span className="mech-limit-name">
                {group.label}
                <span className="mech-limit-short">{group.short}</span>
              </span>
              <CommitNumberInput
                className="mech-limit-input"
                min={0}
                value={location.armor.max}
                label={`${group.label} armor limit`}
                immediate
                onCommit={(max) => onMaxChange(group.ids, 'armor', max)}
              />
              <CommitNumberInput
                className="mech-limit-input"
                min={0}
                value={location.structure.max}
                label={`${group.label} structure limit`}
                immediate
                onCommit={(max) => onMaxChange(group.ids, 'structure', max)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
