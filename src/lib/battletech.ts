import type { BtTurnPhase, Combatant, Encounter } from '../types';
import { rollInitiativeScore, type Rng } from './dice';
import { tickConditions } from './initiative';

export function sideName(combatant: Combatant): string {
  const name = combatant.side.trim();
  return name || 'Unassigned';
}

export function sideNames(encounter: Encounter): string[] {
  return [...new Set(encounter.combatants.map(sideName))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

export function unitsForSide(encounter: Encounter, side: string): Combatant[] {
  return encounter.combatants.filter((combatant) => sideName(combatant) === side);
}

export function unactedUnits(encounter: Encounter, side: string): Combatant[] {
  return unitsForSide(encounter, side).filter(
    (combatant) => !combatant.defeated && !combatant.acted,
  );
}

function buildOrder(
  sides: string[],
  counts: Record<string, number>,
  rolls: Record<string, number | null>,
): string[] {
  const sorted = [...sides].sort((a, b) => {
    const rollA = rolls[a] ?? Number.NEGATIVE_INFINITY;
    const rollB = rolls[b] ?? Number.NEGATIVE_INFINITY;
    if (rollA !== rollB) return rollB - rollA;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
  const remaining = new Map(sides.map((side) => [side, counts[side] ?? 0]));
  const order: string[] = [];
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  while (order.length < total) {
    for (const side of sorted) {
      const left = remaining.get(side) ?? 0;
      if (left > 0) {
        order.push(side);
        remaining.set(side, left - 1);
      }
    }
  }
  return order;
}

export function rollSides(encounter: Encounter, rng?: Rng): Encounter {
  const sides = sideNames(encounter);
  if (sides.length === 0) {
    return { ...encounter, sideRolls: {}, btOrder: [], btIndex: 0, updatedAt: Date.now() };
  }
  const sideRolls: Record<string, number | null> = {};
  const counts: Record<string, number> = {};
  for (const side of sides) {
    sideRolls[side] = rollInitiativeScore('side', 0, rng).total;
    counts[side] = unitsForSide(encounter, side).filter((combatant) => !combatant.defeated).length;
  }
  return {
    ...encounter,
    sideRolls,
    btOrder: buildOrder(sides, counts, sideRolls),
    btIndex: 0,
    combatants: encounter.combatants.map((combatant) => ({
      ...combatant,
      acted: false,
      btPhase: 'movement',
    })),
    updatedAt: Date.now(),
  };
}

/** Keeps side rolls and the activation order in step with the roster. */
export function syncSides(encounter: Encounter): Encounter {
  if (encounter.system !== 'battletech') return encounter;
  const sides = sideNames(encounter);
  const sideRolls: Record<string, number | null> = {};
  for (const side of sides) {
    sideRolls[side] = encounter.sideRolls[side] ?? null;
  }
  const counts: Record<string, number> = {};
  for (const side of sides) {
    counts[side] = unitsForSide(encounter, side).filter((combatant) => !combatant.defeated).length;
  }
  const existing = encounter.btOrder.filter((side) => sides.includes(side));
  const expectedLength = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const btOrder =
    existing.length === expectedLength && existing.length > 0
      ? existing
      : buildOrder(sides, counts, sideRolls);
  return {
    ...encounter,
    sideRolls,
    btOrder,
    btIndex: Math.max(0, Math.min(encounter.btIndex, Math.max(0, btOrder.length - 1))),
  };
}

export function activeSide(encounter: Encounter): string | null {
  if (encounter.system !== 'battletech') return null;
  const side = encounter.btOrder[encounter.btIndex];
  if (!side) return null;
  return unactedUnits(encounter, side).length > 0 ? side : null;
}

export function nextSide(encounter: Encounter, rng?: Rng): Encounter {
  if (encounter.btOrder.length === 0) return rollSides(encounter, rng);

  let index = encounter.btIndex + 1;
  while (
    index < encounter.btOrder.length &&
    unactedUnits(encounter, encounter.btOrder[index]).length === 0
  ) {
    index += 1;
  }

  if (index < encounter.btOrder.length) {
    return { ...encounter, btIndex: index, updatedAt: Date.now() };
  }

  // Round over: tick conditions, reset activations and roll side initiative again.
  const fresh: Encounter = {
    ...encounter,
    round: encounter.round + 1,
    combatants: tickConditions(encounter.combatants).map((combatant) => ({
      ...combatant,
      acted: false,
    })),
  };
  return rollSides(fresh, rng);
}

export function activateUnit(encounter: Encounter, combatantId: string, rng?: Rng): Encounter {
  const marked: Encounter = {
    ...encounter,
    combatants: encounter.combatants.map((combatant) =>
      combatant.id === combatantId ? { ...combatant, acted: true } : combatant,
    ),
    updatedAt: Date.now(),
  };
  return nextSide(marked, rng);
}

export function roundComplete(encounter: Encounter): boolean {
  return (
    encounter.system === 'battletech' &&
    encounter.combatants.every((combatant) => combatant.defeated || combatant.acted)
  );
}

/** The five BattleTech turn phases, in order. */
export const BT_PHASES: readonly BtTurnPhase[] = [
  'movement',
  'attack',
  'heat',
  'piloting',
  'end',
];

/** Human-readable labels for each phase. */
export const BT_PHASE_LABELS: Readonly<Record<BtTurnPhase, string>> = {
  movement: 'Movement',
  attack: 'Attack',
  heat: 'Heat',
  piloting: 'Piloting',
  end: 'End',
};

/** The phase that follows `phase`, clamped at `end`. */
export function nextBtPhase(phase: BtTurnPhase): BtTurnPhase {
  const index = BT_PHASES.indexOf(phase);
  return BT_PHASES[Math.min(BT_PHASES.length - 1, index < 0 ? 0 : index + 1)];
}

/** A unit has finished its turn once it reaches the End phase. */
export function isBtPhaseComplete(phase: BtTurnPhase): boolean {
  return phase === 'end';
}

/** Normalize an arbitrary value into a valid phase, defaulting to Movement. */
export function normBtPhase(
  value: unknown,
  fallback: BtTurnPhase = 'movement',
): BtTurnPhase {
  return (BT_PHASES as readonly string[]).includes(value as string)
    ? (value as BtTurnPhase)
    : fallback;
}

/**
 * The single "Next" action for a unit's turn: advance one phase forward. Once a
 * unit reaches the End phase, it is marked done and the turn moves on to the
 * next unit. This is what the card's "Next →" button drives, so a unit walks
 * through all five phases across successive clicks and only advances the roster
 * when its own turn is complete.
 */
export function nextBtAction(
  encounter: Encounter,
  combatantId: string,
  rng?: Rng,
): Encounter {
  if (encounter.system !== 'battletech') return encounter;
  const target = encounter.combatants.find(
    (combatant) => combatant.id === combatantId,
  );
  if (!target) return encounter;
  if (isBtPhaseComplete(target.btPhase)) return activateUnit(encounter, combatantId, rng);
  return advanceBtPhaseUnit(encounter, combatantId);
}

/**
 * Advance a single unit one phase forward. Units that have already reached the
 * End phase are left untouched.
 */
export function advanceBtPhaseUnit(
  encounter: Encounter,
  combatantId: string,
): Encounter {
  if (encounter.system !== 'battletech') return encounter;
  const target = encounter.combatants.find(
    (combatant) => combatant.id === combatantId,
  );
  if (!target || isBtPhaseComplete(target.btPhase)) return encounter;
  return {
    ...encounter,
    combatants: encounter.combatants.map((combatant) =>
      combatant.id === combatantId
        ? { ...combatant, btPhase: nextBtPhase(combatant.btPhase) }
        : combatant,
    ),
    updatedAt: Date.now(),
  };
}

/**
 * The phase the active side is collectively in: the earliest (lowest) phase
 * among its units that have not yet finished. This mirrors BattleTech, where a
 * side cannot move on until every 'Mech has completed that phase, even though
 * individual units may be advanced further.
 */
export function activeSidePhase(encounter: Encounter): BtTurnPhase | null {
  if (encounter.system !== 'battletech') return null;
  const side = activeSide(encounter);
  if (!side) return null;
  const units = unitsForSide(encounter, side);
  if (units.length === 0) return null;
  const incomplete = units
    .map((combatant) => combatant.btPhase)
    .filter((phase) => phase !== 'end');
  if (incomplete.length === 0) return 'end';
  const earliestIndex = incomplete.reduce(
    (min, phase) => Math.min(min, BT_PHASES.indexOf(phase)),
    BT_PHASES.length,
  );
  return BT_PHASES[earliestIndex];
}
