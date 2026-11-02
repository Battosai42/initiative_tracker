import { describe, expect, it } from 'vitest';
import { createCombatant, createEncounter, normalizeAppData, track } from '../src/lib/factory';
import {
  activateUnit,
  activeSide,
  nextSide,
  rollSides,
  roundComplete,
  sideNames,
  syncSides,
} from '../src/lib/battletech';

function mech(name: string, side: string) {
  return createCombatant({ name, side, armor: track(10), structure: track(5) });
}

function btEncounter() {
  const a1 = mech('Alpha 1', 'Alpha');
  const a2 = mech('Alpha 2', 'Alpha');
  const a3 = mech('Alpha 3', 'Alpha');
  const b1 = mech('Bravo 1', 'Bravo');
  const b2 = mech('Bravo 2', 'Bravo');
  return {
    encounter: {
      ...createEncounter('battletech', 'Test'),
      combatants: [a1, a2, a3, b1, b2],
    },
    a1,
    b1,
  };
}

describe('Battletech side initiative', () => {
  it('lists sides and builds an alternating activation order', () => {
    const { encounter } = btEncounter();
    expect(sideNames(encounter)).toEqual(['Alpha', 'Bravo']);
    const rolled = rollSides(encounter, () => 3);
    expect(rolled.sideRolls).toEqual({ Alpha: 6, Bravo: 6 });
    expect(rolled.btOrder).toEqual(['Alpha', 'Bravo', 'Alpha', 'Bravo', 'Alpha']);
    expect(activeSide(rolled)).toBe('Alpha');
  });

  it('gives the higher roll the first activation', () => {
    const { encounter } = btEncounter();
    let roll = 0;
    const rolled = rollSides(encounter, () => {
      roll += 1;
      return roll <= 2 ? 6 : 1;
    });
    expect(rolled.sideRolls.Alpha).toBe(12);
    expect(rolled.sideRolls.Bravo).toBe(2);
    expect(rolled.btOrder[0]).toBe('Alpha');
  });

  it('passes to the next side when a unit activates', () => {
    const { encounter, a1 } = btEncounter();
    const rolled = rollSides(encounter, () => 3);
    const next = activateUnit(rolled, a1.id, () => 3);
    expect(next.btIndex).toBe(1);
    expect(activeSide(next)).toBe('Bravo');
    expect(next.combatants.find((unit) => unit.id === a1.id)?.acted).toBe(true);
  });

  it('rolls a fresh round when every activation is spent', () => {
    const { encounter } = btEncounter();
    let current = rollSides(encounter, () => 3);
    for (let i = 0; i < 5; i += 1) {
      const active = activeSide(current);
      const unit = current.combatants.find(
        (entry) => entry.side === active && !entry.acted && !entry.defeated,
      );
      current = activateUnit(current, unit!.id, () => 3);
    }
    expect(current.round).toBe(2);
    expect(current.combatants.every((unit) => !unit.acted)).toBe(true);
    expect(roundComplete(current)).toBe(false);
  });

  it('ignores destroyed units when building the order', () => {
    const { encounter } = btEncounter();
    const withDestroyed = {
      ...encounter,
      combatants: encounter.combatants.map((unit) =>
        unit.name === 'Alpha 2' ? { ...unit, defeated: true } : unit,
      ),
    };
    const synced = syncSides(withDestroyed);
    expect(synced.btOrder.filter((side) => side === 'Alpha')).toHaveLength(2);
  });

  it('advances to the next side directly', () => {
    const { encounter } = btEncounter();
    const rolled = rollSides(encounter, () => 3);
    expect(nextSide(rolled).btIndex).toBe(1);
  });
});

describe('import normalisation', () => {
  it('repairs missing or invalid values and gives fresh ids', () => {
    const raw = {
      encounters: [
        {
          id: 'old',
          name: 'Imported',
          system: 'dnd5e',
          round: '3',
          combatants: [
            {
              name: 'Hero',
              role: 'pc',
              initiative: '17',
              hp: { current: 30, max: 24, temp: -2 },
              conditions: [{ label: 'Prone', rounds: 2 }, { label: '' }],
              nonsense: true,
            },
          ],
        },
      ],
    };
    const data = normalizeAppData(raw, true);
    expect(data).not.toBeNull();
    const encounter = data!.encounters[0];
    expect(encounter.id).not.toBe('old');
    expect(encounter.round).toBe(3);
    const hero = encounter.combatants[0];
    expect(hero.name).toBe('Hero');
    expect(hero.role).toBe('pc');
    expect(hero.initiative).toBe(17);
    expect(hero.hp.current).toBe(24);
    expect(hero.hp.temp).toBe(0);
    expect(hero.conditions).toHaveLength(1);
  });

  it('returns null for unrelated JSON', () => {
    expect(normalizeAppData({ hello: 'world' }, true)).toBeNull();
  });
});
