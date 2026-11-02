import { describe, expect, it } from 'vitest';
import { createCombatant, createEncounter, track } from '../src/lib/factory';
import {
  nextTurn,
  previousTurn,
  rerollAll,
  sortForDisplay,
  turnOrder,
} from '../src/lib/initiative';
import type { Encounter } from '../src/types';

function withCombatants(
  encounter: Encounter,
  ...combatants: ReturnType<typeof createCombatant>[]
): Encounter {
  return {
    ...encounter,
    combatants,
    activeId: [...combatants].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))[0]?.id ?? null,
  };
}

describe('initiative order', () => {
  it('sorts by initiative, then tiebreak, then name', () => {
    const a = createCombatant({ name: 'Bravo', initiative: 15, tiebreak: 2 });
    const b = createCombatant({ name: 'Alpha', initiative: 15, tiebreak: 4 });
    const c = createCombatant({ name: 'Charlie', initiative: 20, tiebreak: 0 });
    const d = createCombatant({ name: 'Delta', initiative: null });
    const sorted = sortForDisplay([a, b, c, d]);
    expect(sorted.map((entry) => entry.name)).toEqual(['Charlie', 'Alpha', 'Bravo', 'Delta']);
  });

  it('pushes defeated combatants to the bottom', () => {
    const a = createCombatant({ name: 'Down', initiative: 30, defeated: true });
    const b = createCombatant({ name: 'Up', initiative: 2 });
    expect(turnOrder({ ...createEncounter(), combatants: [a, b] }).map((entry) => entry.name)).toEqual([
      'Up',
    ]);
    expect(sortForDisplay([a, b]).map((entry) => entry.name)).toEqual(['Up', 'Down']);
  });
});

describe('turn advancement', () => {
  it('cycles through combatants and increments the round on wrap', () => {
    const a = createCombatant({ name: 'A', initiative: 20 });
    const b = createCombatant({ name: 'B', initiative: 15 });
    const c = createCombatant({ name: 'C', initiative: 10 });
    let encounter = withCombatants(createEncounter('dnd5e'), a, b, c);

    encounter = nextTurn(encounter);
    expect(encounter.activeId).toBe(b.id);
    expect(encounter.round).toBe(1);

    encounter = nextTurn(encounter);
    expect(encounter.activeId).toBe(c.id);

    encounter = nextTurn(encounter);
    expect(encounter.activeId).toBe(a.id);
    expect(encounter.round).toBe(2);
  });

  it('applies HP regeneration when a monster begins its turn', () => {
    const regenerator = createCombatant({ name: 'Regen', initiative: 20, hp: track(10, 2), regen: 4 });
    const slow = createCombatant({ name: 'Slow', initiative: 5 });
    let encounter = withCombatants(createEncounter('starfinder1e'), slow, regenerator);
    encounter = { ...encounter, activeId: slow.id };

    encounter = nextTurn(encounter);
    expect(encounter.activeId).toBe(regenerator.id);
    expect(encounter.combatants.find((entry) => entry.id === regenerator.id)?.hp.current).toBe(6);
  });

  it('does not regenerate while another combatant is active', () => {
    const regenerator = createCombatant({ name: 'Regen', initiative: 20, hp: track(10, 2), regen: 4 });
    const slow = createCombatant({ name: 'Slow', initiative: 5 });
    let encounter = withCombatants(createEncounter('starfinder1e'), regenerator, slow);
    // Regenerator is active; advancing to Slow must not heal it.
    encounter = nextTurn(encounter);
    expect(encounter.activeId).toBe(slow.id);
    expect(encounter.combatants.find((entry) => entry.id === regenerator.id)?.hp.current).toBe(2);
  });

  it('ticks timed conditions when a round ends', () => {
    const a = createCombatant({
      name: 'A',
      initiative: 20,
      conditions: [
        { id: 'c1', label: 'Stunned', rounds: 2 },
        { id: 'c2', label: 'Prone', rounds: null },
      ],
    });
    const b = createCombatant({ name: 'B', initiative: 10 });
    let encounter = withCombatants(createEncounter('dnd5e'), a, b);
    encounter = nextTurn(encounter);
    expect(encounter.combatants.find((entry) => entry.id === a.id)?.conditions[0].rounds).toBe(2);

    encounter = nextTurn(encounter);
    expect(encounter.round).toBe(2);
    const conditions = encounter.combatants.find((entry) => entry.id === a.id)?.conditions ?? [];
    expect(conditions.find((condition) => condition.id === 'c1')?.rounds).toBe(1);
    expect(conditions.find((condition) => condition.id === 'c2')).toBeDefined();
  });

  it('moves backwards without changing conditions', () => {
    const a = createCombatant({ name: 'A', initiative: 20 });
    const b = createCombatant({ name: 'B', initiative: 10 });
    let encounter = withCombatants(createEncounter('dnd5e'), a, b);
    encounter = nextTurn(encounter);
    encounter = previousTurn(encounter);
    expect(encounter.activeId).toBe(a.id);
  });

  it('rerolls all initiatives for non-Battletech systems', () => {
    const a = createCombatant({ name: 'A', initiative: 3, initMod: 5 });
    const b = createCombatant({ name: 'B', initiative: 2, initMod: 0 });
    const encounter = withCombatants(createEncounter('dnd5e'), a, b);
    const rerolled = rerollAll(encounter, () => 10);
    expect(rerolled.combatants.every((entry) => entry.initiative === 15 || entry.initiative === 10)).toBe(
      true,
    );
    expect(rerolled.activeId).toBe(a.id);
  });
});

describe('Shadowrun initiative passes', () => {
  it('reduces the active score by 10 and reorders, then starts a new round', () => {
    const a = createCombatant({ name: 'A', initiative: 21, initMod: 11 });
    const b = createCombatant({ name: 'B', initiative: 18, initMod: 10 });
    const c = createCombatant({ name: 'C', initiative: 7, initMod: 0 });
    let encounter = withCombatants(createEncounter('shadowrun'), a, b, c);

    encounter = nextTurn(encounter);
    expect(encounter.combatants.find((entry) => entry.id === a.id)?.initiative).toBe(11);
    expect(encounter.activeId).toBe(b.id);

    encounter = nextTurn(encounter);
    expect(encounter.combatants.find((entry) => entry.id === b.id)?.initiative).toBe(8);
    expect(encounter.activeId).toBe(a.id);

    encounter = nextTurn(encounter);
    expect(encounter.combatants.find((entry) => entry.id === a.id)?.initiative).toBe(1);
    expect(encounter.activeId).toBe(b.id);

    encounter = nextTurn(encounter);
    expect(encounter.combatants.find((entry) => entry.id === b.id)?.initiative).toBe(-2);
    expect(encounter.activeId).toBe(c.id);

    encounter = nextTurn(encounter);
    expect(encounter.combatants.find((entry) => entry.id === c.id)?.initiative).toBe(-3);
    expect(encounter.activeId).toBe(a.id);

    encounter = nextTurn(encounter, () => 1);
    expect(encounter.round).toBe(2);
    expect(encounter.combatants.find((entry) => entry.id === a.id)?.initiative).toBe(12);
    expect(encounter.combatants.find((entry) => entry.id === b.id)?.initiative).toBe(11);
    expect(encounter.combatants.find((entry) => entry.id === c.id)?.initiative).toBe(1);
    expect(encounter.activeId).toBe(a.id);
  });

  it('ignores defeated combatants', () => {
    const a = createCombatant({ name: 'A', initiative: 20, hp: track(0), defeated: true });
    const b = createCombatant({ name: 'B', initiative: 10 });
    const encounter = withCombatants({ ...createEncounter('shadowrun'), activeId: b.id }, a, b);
    expect(nextTurn(encounter, () => 1).activeId).toBe(b.id);
  });
});
