import type { Combatant, Encounter } from '../types';
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
    combatants: encounter.combatants.map((combatant) => ({ ...combatant, acted: false })),
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
