import type {
  BtLocation,
  BtLocationId,
  BtLocations,
  Combatant,
  ConditionInstance,
  Track,
} from '../types';

/** The heat scale used by the table-top game. */
export const BT_HEAT_MAX = 30;
/** At this heat a unit must make a shutdown check. */
export const BT_HEAT_SHUTDOWN = 14;

export interface BtLocationInfo {
  id: BtLocationId;
  label: string;
  short: string;
  /** Where excess damage goes once this location is destroyed. */
  transfer: BtLocationId | null;
}

/**
 * Standard 'Mech locations in display order. Excess damage follows the
 * BattleTech transfer diagram: limbs into their side torso, side torsos into
 * the center torso. The head and center torso have nowhere left to go.
 */
export const BT_LOCATION_INFO: Record<BtLocationId, BtLocationInfo> = {
  head: { id: 'head', label: 'Head', short: 'H', transfer: null },
  leftArm: { id: 'leftArm', label: 'Left Arm', short: 'LA', transfer: 'leftTorso' },
  leftTorso: { id: 'leftTorso', label: 'Left Torso', short: 'LT', transfer: 'centerTorso' },
  centerTorso: { id: 'centerTorso', label: 'Center Torso', short: 'CT', transfer: null },
  rightTorso: { id: 'rightTorso', label: 'Right Torso', short: 'RT', transfer: 'centerTorso' },
  rightArm: { id: 'rightArm', label: 'Right Arm', short: 'RA', transfer: 'rightTorso' },
  leftLeg: { id: 'leftLeg', label: 'Left Leg', short: 'LL', transfer: 'leftTorso' },
  rightLeg: { id: 'rightLeg', label: 'Right Leg', short: 'RL', transfer: 'rightTorso' },
};

export const BT_LOCATION_IDS: BtLocationId[] = [
  'head',
  'leftArm',
  'leftTorso',
  'centerTorso',
  'rightTorso',
  'rightArm',
  'leftLeg',
  'rightLeg',
];

/**
 * Rough share of a 'Mech's total armor/structure that sits in each mirrored
 * group. Paired locations are split evenly so left and right always have the
 * same maximum; any odd pair point is absorbed by the center torso.
 */
interface BtGroupShares {
  head: number;
  centerTorso: number;
  sideTorsos: number;
  arms: number;
  legs: number;
}

const ARMOR_SHARE: BtGroupShares = {
  head: 0.06,
  centerTorso: 0.24,
  sideTorsos: 0.3,
  arms: 0.2,
  legs: 0.2,
};

const STRUCTURE_SHARE: BtGroupShares = {
  head: 0.06,
  centerTorso: 0.26,
  sideTorsos: 0.3,
  arms: 0.18,
  legs: 0.2,
};

function emptyLocation(): BtLocation {
  return {
    armor: { current: 0, max: 0, temp: 0 },
    structure: { current: 0, max: 0, temp: 0 },
    destroyed: false,
  };
}

/**
 * Split a total across the mirrored groups. Largest remainders get the
 * leftover points, then each pair is halved and any odd point is moved to the
 * center torso so left and right stay symmetrical without losing a point.
 */
function splitSymmetric(
  total: number,
  shares: BtGroupShares,
): Record<BtLocationId, number> {
  const safe = Math.max(0, Math.floor(total));
  const keys = Object.keys(shares) as Array<keyof BtGroupShares>;
  const groups = keys.map((key) => {
    const exact = safe * shares[key];
    const base = Math.floor(exact);
    return { key, base, remainder: exact - base };
  });
  let assigned = groups.reduce((sum, group) => sum + group.base, 0);
  const byRemainder = [...groups].sort((a, b) => b.remainder - a.remainder);
  let index = 0;
  while (assigned < safe) {
    byRemainder[index % byRemainder.length].base += 1;
    assigned += 1;
    index += 1;
  }

  const value = {} as Record<keyof BtGroupShares, number>;
  for (const group of groups) value[group.key] = group.base;

  const leftover =
    (value.sideTorsos % 2) + (value.arms % 2) + (value.legs % 2);
  const sideTorsos = Math.floor(value.sideTorsos / 2);
  const arms = Math.floor(value.arms / 2);
  const legs = Math.floor(value.legs / 2);

  return {
    head: value.head,
    centerTorso: value.centerTorso + leftover,
    leftTorso: sideTorsos,
    rightTorso: sideTorsos,
    leftArm: arms,
    rightArm: arms,
    leftLeg: legs,
    rightLeg: legs,
  };
}

/** Spread a current total over the limits, keeping every value within its max. */
function distributeCurrent(
  maxValues: Record<BtLocationId, number>,
  total: number,
): Record<BtLocationId, number> {
  const maxTotal = BT_LOCATION_IDS.reduce((sum, id) => sum + maxValues[id], 0);
  const safe = Math.max(0, Math.min(Math.floor(total), maxTotal));
  const result = {} as Record<BtLocationId, number>;

  if (safe === 0 || maxTotal === 0) {
    for (const id of BT_LOCATION_IDS) result[id] = 0;
    return result;
  }
  if (safe === maxTotal) {
    for (const id of BT_LOCATION_IDS) result[id] = maxValues[id];
    return result;
  }

  const parts = BT_LOCATION_IDS.map((id) => {
    const exact = (maxValues[id] / maxTotal) * safe;
    const base = Math.min(maxValues[id], Math.floor(exact));
    return {
      id,
      base,
      remainder: exact - Math.floor(exact),
      capacity: maxValues[id] - base,
    };
  });
  let assigned = parts.reduce((sum, part) => sum + part.base, 0);
  const byRemainder = parts
    .filter((part) => part.capacity > 0)
    .sort((a, b) => b.remainder - a.remainder);

  let index = 0;
  while (assigned < safe && byRemainder.length > 0) {
    const part = byRemainder[index % byRemainder.length];
    if (part.capacity > 0) {
      part.base += 1;
      part.capacity -= 1;
      assigned += 1;
    }
    index += 1;
  }

  for (const part of parts) result[part.id] = part.base;
  return result;
}

/**
 * Build a full set of hit locations from aggregate armor/structure totals.
 * Maximums are mirrored across left and right. Current values are spread
 * proportionally so an imported or older unit keeps its overall damage.
 */
export function createBtLocations(
  armorMax = 0,
  structureMax = 0,
  armorCurrent = armorMax,
  structureCurrent = structureMax,
): BtLocations {
  const armorMaxParts = splitSymmetric(armorMax, ARMOR_SHARE);
  const structureMaxParts = splitSymmetric(structureMax, STRUCTURE_SHARE);
  const armorCurrentParts = distributeCurrent(armorMaxParts, armorCurrent);
  const structureCurrentParts = distributeCurrent(
    structureMaxParts,
    structureCurrent,
  );

  const locations = {} as BtLocations;
  for (const id of BT_LOCATION_IDS) {
    locations[id] = {
      armor: {
        current: armorCurrentParts[id],
        max: armorMaxParts[id],
        temp: 0,
      },
      structure: {
        current: structureCurrentParts[id],
        max: structureMaxParts[id],
        temp: 0,
      },
      destroyed: false,
    };
  }
  return locations;
}

export function cloneBtLocations(locations: BtLocations): BtLocations {
  const next = {} as BtLocations;
  for (const id of BT_LOCATION_IDS) {
    const location = locations?.[id] ?? emptyLocation();
    next[id] = {
      armor: { ...location.armor },
      structure: { ...location.structure },
      destroyed: location.destroyed,
    };
  }
  return next;
}

export function btLocationTotals(locations: BtLocations): {
  armor: Track;
  structure: Track;
} {
  const armor: Track = { current: 0, max: 0, temp: 0 };
  const structure: Track = { current: 0, max: 0, temp: 0 };
  for (const id of BT_LOCATION_IDS) {
    const location = locations?.[id];
    if (!location) continue;
    armor.current += location.armor.current;
    armor.max += location.armor.max;
    structure.current += location.structure.current;
    structure.max += location.structure.max;
  }
  return { armor, structure };
}

/** A location is gone once its internal structure is used up. */
export function isBtLocationDestroyed(location: BtLocation): boolean {
  return (
    location.destroyed ||
    (location.structure.max > 0 && location.structure.current <= 0)
  );
}

/** A 'Mech is destroyed when its head or center torso is destroyed. */
export function isMechDestroyed(locations: BtLocations): boolean {
  return (
    isBtLocationDestroyed(locations.head) ||
    isBtLocationDestroyed(locations.centerTorso)
  );
}

function destroyedCondition(conditions: ConditionInstance[]): ConditionInstance[] {
  if (conditions.some((condition) => condition.label === 'Destroyed')) return conditions;
  return [
    ...conditions,
    { id: `cond_${Date.now()}_destroyed`, label: 'Destroyed', rounds: null },
  ];
}

/** Copy location totals back onto the combatant and resolve unit destruction. */
export function syncBtTotals(combatant: Combatant): Combatant {
  const totals = btLocationTotals(combatant.locations);
  const destroyed = isMechDestroyed(combatant.locations);
  return {
    ...combatant,
    armor: totals.armor,
    structure: totals.structure,
    defeated: destroyed ? true : combatant.defeated,
    conditions: destroyed ? destroyedCondition(combatant.conditions) : combatant.conditions,
  };
}

function destroyBtLocation(locations: BtLocations, id: BtLocationId): void {
  const location = locations[id];
  location.armor.current = 0;
  location.structure.current = 0;
  location.destroyed = true;
}

/**
 * Applies damage to one hit location. Armor absorbs first; any overflow goes
 * into that location's internal structure. Once the structure is gone the
 * remaining damage follows the transfer diagram (limb → side torso → center
 * torso). Side-torso loss also blows off the arm on that side.
 */
export function damageBtLocation(
  combatant: Combatant,
  locationId: BtLocationId,
  amount: number,
): Combatant {
  const incoming = Math.max(0, Math.floor(amount));
  if (incoming <= 0) return combatant;

  const locations = cloneBtLocations(combatant.locations);
  let remaining = incoming;
  let target: BtLocationId | null = locationId;
  const visited = new Set<BtLocationId>();

  while (target && remaining > 0 && !visited.has(target)) {
    visited.add(target);
    const location = locations[target];

    // Already blown off: nothing here to hit, so pass the damage inward.
    if (isBtLocationDestroyed(location)) {
      target = BT_LOCATION_INFO[target].transfer;
      continue;
    }

    const armorAbsorbed = Math.min(location.armor.current, remaining);
    location.armor.current -= armorAbsorbed;
    remaining -= armorAbsorbed;

    if (remaining > 0 && location.structure.max > 0) {
      const structureAbsorbed = Math.min(location.structure.current, remaining);
      location.structure.current -= structureAbsorbed;
      remaining -= structureAbsorbed;
    }

    const structureGone =
      location.structure.max > 0 && location.structure.current <= 0;
    const untrackedStructure = location.structure.max <= 0;

    if (structureGone) {
      location.destroyed = true;
      if (target === 'leftTorso') destroyBtLocation(locations, 'leftArm');
      if (target === 'rightTorso') destroyBtLocation(locations, 'rightArm');
      target = BT_LOCATION_INFO[target].transfer;
    } else if (untrackedStructure && location.armor.current <= 0) {
      // A location with no internal-structure pool still routes overflow on.
      target = BT_LOCATION_INFO[target].transfer;
    } else {
      break;
    }
  }

  return syncBtTotals({ ...combatant, locations });
}

/**
 * Repairs one location. Structure is restored first, then armor, so a single
 * heal field can bring a damaged section back to full.
 */
export function healBtLocation(
  combatant: Combatant,
  locationId: BtLocationId,
  amount: number,
): Combatant {
  const incoming = Math.max(0, Math.floor(amount));
  if (incoming <= 0) return combatant;

  const locations = cloneBtLocations(combatant.locations);
  const location = locations[locationId];
  let remaining = incoming;

  const structureGain = Math.min(
    Math.max(0, location.structure.max - location.structure.current),
    remaining,
  );
  location.structure.current += structureGain;
  remaining -= structureGain;

  const armorGain = Math.min(
    Math.max(0, location.armor.max - location.armor.current),
    remaining,
  );
  location.armor.current += armorGain;

  if (location.structure.current > 0) location.destroyed = false;

  return syncBtTotals({ ...combatant, locations });
}

/**
 * Set a location's current armor or structure directly. This is a manual
 * correction (for example, when entering a unit's condition mid-fight), so it
 * does not transfer overflow. Setting structure above zero clears the
 * destroyed flag so the location can be restored.
 */
export function setBtLocationCurrent(
  combatant: Combatant,
  locationId: BtLocationId,
  pool: 'armor' | 'structure',
  current: number,
): Combatant {
  const locations = cloneBtLocations(combatant.locations);
  const location = locations[locationId];
  const track = location[pool];
  const desired = Math.max(0, Math.round(current));

  // Units saved before per-location limits existed can have a 0/0 pool. Treat
  // a direct entry as the new limit in that case, otherwise the value would
  // always be clamped back to 0 and could never be assigned.
  if (track.max === 0 && desired > 0) track.max = desired;

  const nextCurrent = Math.max(0, Math.min(track.max, desired));
  track.current = nextCurrent;

  if (pool === 'structure' && nextCurrent > 0) {
    location.destroyed = false;
  }

  return syncBtTotals({ ...combatant, locations });
}

/**
 * Change a location's armor or structure limit. Increasing a limit fills the
 * new capacity; decreasing it clamps the current value.
 */
export function setBtLocationMax(
  combatant: Combatant,
  locationId: BtLocationId,
  pool: 'armor' | 'structure',
  max: number,
): Combatant {
  const locations = cloneBtLocations(combatant.locations);
  const location = locations[locationId];
  const track = location[pool];
  const nextMax = Math.max(0, Math.round(max));
  const added = Math.max(0, nextMax - track.max);
  track.max = nextMax;
  track.current = Math.min(nextMax, Math.max(0, track.current + added));

  if (pool === 'structure' && (nextMax === 0 || location.structure.current > 0)) {
    location.destroyed = false;
  }

  return syncBtTotals({ ...combatant, locations });
}

/** Refills every location without touching heat, pilot hits or conditions. */
export function repairBtDamage(combatant: Combatant): Combatant {
  const locations = cloneBtLocations(combatant.locations);
  for (const id of BT_LOCATION_IDS) {
    const location = locations[id];
    location.armor.current = location.armor.max;
    location.structure.current = location.structure.max;
    location.destroyed = false;
  }
  const synced = syncBtTotals({ ...combatant, locations });
  return { ...synced, defeated: combatant.defeated };
}
