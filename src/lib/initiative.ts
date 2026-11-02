import type { Combatant, Encounter } from '../types';
import { applyRegeneration } from './hp';
import { rollInitiativeScore, type Rng } from './dice';

function initiativeValue(combatant: Combatant): number {
  return combatant.initiative ?? Number.NEGATIVE_INFINITY;
}

/** Sorts combatants for the turn order: highest initiative first, ties by tiebreak then name. */
export function compareCombatants(a: Combatant, b: Combatant): number {
  const byInitiative = initiativeValue(b) - initiativeValue(a);
  if (byInitiative !== 0) return byInitiative;
  const byTiebreak = b.tiebreak - a.tiebreak;
  if (byTiebreak !== 0) return byTiebreak;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

/** Display order keeps defeated combatants at the bottom of the list. */
export function sortForDisplay(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => {
    if (a.defeated !== b.defeated) return a.defeated ? 1 : -1;
    return compareCombatants(a, b);
  });
}

export function turnOrder(encounter: Encounter): Combatant[] {
  return encounter.combatants.filter((combatant) => !combatant.defeated).sort(compareCombatants);
}

export function getActiveCombatant(encounter: Encounter): Combatant | null {
  return encounter.combatants.find((combatant) => combatant.id === encounter.activeId) ?? null;
}

export function tickConditions(combatants: Combatant[]): Combatant[] {
  return combatants.map((combatant) => ({
    ...combatant,
    conditions: combatant.conditions.flatMap((condition) => {
      if (condition.rounds === null) return [condition];
      if (condition.rounds <= 1) return [];
      return [{ ...condition, rounds: condition.rounds - 1 }];
    }),
  }));
}

function newRound(encounter: Encounter): Encounter {
  return {
    ...encounter,
    round: encounter.round + 1,
    combatants: tickConditions(encounter.combatants),
    updatedAt: Date.now(),
  };
}

/**
 * When a creature with HP regeneration begins its turn it heals `regen` HP up to
 * its max. Applied on turn advancement only (not on manual activation) so a
 * monster regenerates exactly once per turn, at the start of its turn.
 */
function applyTurnRegeneration(encounter: Encounter, combatantId: string): Encounter {
  const target = encounter.combatants.find((entry) => entry.id === combatantId);
  if (!target || target.regen <= 0) return encounter;
  return {
    ...encounter,
    combatants: encounter.combatants.map((entry) =>
      entry.id === combatantId ? applyRegeneration(entry) : entry,
    ),
  };
}

function nextShadowrunTurn(encounter: Encounter, rng?: Rng): Encounter {
  const combatants = encounter.combatants.map((combatant) => {
    if (combatant.id !== encounter.activeId || combatant.defeated) return combatant;
    return {
      ...combatant,
      initiative: (combatant.initiative ?? 0) - 10,
    };
  });

  const remaining = combatants
    .filter((combatant) => !combatant.defeated && (combatant.initiative ?? 0) > 0)
    .sort(compareCombatants);

  if (remaining.length > 0) {
    return {
      ...encounter,
      combatants,
      activeId: remaining[0].id,
      updatedAt: Date.now(),
    };
  }

  // Every initiative pass is spent: start a fresh round and reroll initiative.
  const rerolled = tickConditions(combatants).map((combatant) => {
    if (combatant.defeated) return combatant;
    return {
      ...combatant,
      initiative: rollInitiativeScore('shadowrun', combatant.initMod, rng).total,
    };
  });
  const order = rerolled.filter((combatant) => !combatant.defeated).sort(compareCombatants);

  return {
    ...encounter,
    round: encounter.round + 1,
    combatants: rerolled,
    activeId: order[0]?.id ?? null,
    updatedAt: Date.now(),
  };
}

export function nextTurn(encounter: Encounter, rng?: Rng): Encounter {
  if (encounter.system === 'shadowrun') {
    return nextShadowrunTurn(encounter, rng);
  }

  const order = turnOrder(encounter);
  if (order.length === 0) return encounter;

  const index = order.findIndex((combatant) => combatant.id === encounter.activeId);
  if (index === -1) {
    const regenerated = applyTurnRegeneration(encounter, order[0].id);
    return { ...regenerated, activeId: order[0].id, updatedAt: Date.now() };
  }

  if (index === order.length - 1) {
    const advanced = newRound(encounter);
    const regenerated = applyTurnRegeneration(advanced, order[0].id);
    return { ...regenerated, activeId: order[0].id };
  }

  const nextActive = order[index + 1];
  const regenerated = applyTurnRegeneration(encounter, nextActive.id);
  return { ...regenerated, activeId: nextActive.id, updatedAt: Date.now() };
}

export function previousTurn(encounter: Encounter): Encounter {
  const order = turnOrder(encounter);
  if (order.length === 0) return encounter;

  const index = order.findIndex((combatant) => combatant.id === encounter.activeId);
  if (index === -1) {
    return { ...encounter, activeId: order[0].id, updatedAt: Date.now() };
  }
  if (index === 0) {
    return {
      ...encounter,
      round: Math.max(1, encounter.round - 1),
      activeId: order[order.length - 1].id,
      updatedAt: Date.now(),
    };
  }
  return {
    ...encounter,
    activeId: order[index - 1].id,
    updatedAt: Date.now(),
  };
}

/**
 * Rolls a fresh initiative score for every combatant and makes the winner active.
 * Shadowrun rerolls with its 1d6 formula; Battletech uses side rolls instead.
 */
export function rerollAll(encounter: Encounter, rng?: Rng): Encounter {
  if (encounter.system === 'battletech') return encounter;

  const mode =
    encounter.system === 'shadowrun'
      ? 'shadowrun'
      : encounter.system === 'generic'
        ? 'd20'
        : 'd20';

  const combatants = encounter.combatants.map((combatant) => {
    if (combatant.defeated) return combatant;
    return {
      ...combatant,
      initiative: rollInitiativeScore(mode, combatant.initMod, rng).total,
      acted: false,
    };
  });

  const order = combatants.filter((combatant) => !combatant.defeated).sort(compareCombatants);

  return {
    ...encounter,
    combatants,
    activeId: order[0]?.id ?? null,
    updatedAt: Date.now(),
  };
}

export function rerollCombatant(encounter: Encounter, combatantId: string, rng?: Rng): Encounter {
  const combatant = encounter.combatants.find((entry) => entry.id === combatantId);
  if (!combatant) return encounter;
  const mode = encounter.system === 'shadowrun' ? 'shadowrun' : 'd20';
  const score = rollInitiativeScore(mode, combatant.initMod, rng).total;
  return {
    ...encounter,
    combatants: encounter.combatants.map((entry) =>
      entry.id === combatantId ? { ...entry, initiative: score } : entry,
    ),
    updatedAt: Date.now(),
  };
}
