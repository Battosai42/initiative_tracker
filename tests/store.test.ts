import { describe, expect, it } from 'vitest';
import { reducer } from '../src/state/store';
import {
  createAppData,
  createCombatant,
  combatantToTemplate,
} from '../src/lib/factory';
import type { Combatant, CombatantTemplate, Encounter } from '../src/types';

function withCombatants(templates: CombatantTemplate[], ...combatants: Combatant[]): Parameters<typeof reducer>[0] {
  const data = createAppData();
  const encounter = data.encounters[0];
  return {
    data: { ...data, encounters: [{ ...encounter, combatants }], templates },
    undo: { [encounter.id]: [] },
    diceLog: [],
  };
}

function encounter(state: Parameters<typeof reducer>[0]): Encounter {
  return state.data.encounters[0];
}

describe('updateTemplate reducer', () => {
  it('syncs matching combatants across every encounter with the new values', () => {
    const goblinA = createCombatant({ name: 'Goblin', role: 'monster', hp: { current: 4, max: 10, temp: 0 } });
    const goblinB = createCombatant({ name: 'Goblin', role: 'monster', hp: { current: 6, max: 12, temp: 0 } });
    const orc = createCombatant({ name: 'Orc', role: 'monster', hp: { current: 9, max: 9, temp: 0 } });
    const template = combatantToTemplate(goblinA);
    const state = withCombatants([template], goblinA, orc);
    const state2 = {
      ...state,
      data: {
        ...state.data,
        encounters: [
          ...state.data.encounters,
          { ...createAppData().encounters[0], id: 'e2', combatants: [goblinB, orc] },
        ],
      },
    };

    const next = reducer(state2, {
      type: 'updateTemplate',
      role: 'monster',
      name: 'Goblin',
      update: { hpMax: 40, ac: 22, cr: 5 },
    });

    expect(next.data.encounters.map((encounter) => encounter.combatants.map((c) => c.name))).toEqual([
      ['Goblin', 'Orc'],
      ['Goblin', 'Orc'],
    ]);
    for (const encounter of next.data.encounters) {
      const goblin = encounter.combatants.find((c) => c.name === 'Goblin');
      expect(goblin?.hp.max).toBe(40);
      expect(goblin?.ac).toBe(22);
      expect(goblin?.cr).toBe(5);
    }
    // The library entry itself is updated too.
    expect(next.data.templates[0].hpMax).toBe(40);
    expect(next.data.templates[0].ac).toBe(22);
  });

  it('preserves each combatant instance state while syncing', () => {
    const goblin = createCombatant({
      name: 'Goblin',
      role: 'monster',
      initiative: 15,
      notes: 'front line',
      defeated: true,
      heat: 8,
      hp: { current: 4, max: 10, temp: 0 },
    });
    const state = withCombatants([combatantToTemplate(goblin)], goblin);

    const next = reducer(state, {
      type: 'updateTemplate',
      role: 'monster',
      name: 'Goblin',
      update: { hpMax: 3 },
    });

    const synced = encounter(next).combatants[0];
    expect(synced.hp.max).toBe(3);
    expect(synced.hp.current).toBe(3);
    expect(synced.initiative).toBe(15);
    expect(synced.notes).toBe('front line');
    expect(synced.defeated).toBe(true);
    expect(synced.heat).toBe(8);
  });

  it('only touches combatants matching the role and name', () => {
    const goblin = createCombatant({ name: 'Goblin', role: 'monster' });
    const orc = createCombatant({ name: 'Orc', role: 'monster' });
    const state = withCombatants([combatantToTemplate(goblin)], goblin, orc);

    const next = reducer(state, {
      type: 'updateTemplate',
      role: 'monster',
      name: 'Goblin',
      update: { ac: 99 },
    });

    const combatants = encounter(next).combatants;
    expect(combatants.find((c) => c.name === 'Goblin')?.ac).toBe(99);
    expect(combatants.find((c) => c.name === 'Orc')?.ac).toBe(0);
  });

  it('applies a rename to the matching combatants', () => {
    const goblin = createCombatant({ name: 'Goblin', role: 'monster' });
    const state = withCombatants([combatantToTemplate(goblin)], goblin);

    const next = reducer(state, {
      type: 'updateTemplate',
      role: 'monster',
      name: 'Goblin',
      update: { name: 'Goblin Boss', role: 'npc' },
    });

    const combatant = encounter(next).combatants[0];
    expect(combatant.name).toBe('Goblin Boss');
    expect(combatant.role).toBe('npc');
    expect(next.data.templates[0].name).toBe('Goblin Boss');
  });

  it('is a no-op when no template matches', () => {
    const goblin = createCombatant({ name: 'Goblin', role: 'monster' });
    const state = withCombatants([], goblin);

    const next = reducer(state, {
      type: 'updateTemplate',
      role: 'monster',
      name: 'Orc',
      update: { ac: 99 },
    });

    expect(next).toBe(state);
    expect(encounter(next).combatants[0].ac).toBe(0);
  });

  it('records an undo entry for the affected encounter', () => {
    const goblin = createCombatant({ name: 'Goblin', role: 'monster' });
    const state = withCombatants([combatantToTemplate(goblin)], goblin);

    const next = reducer(state, {
      type: 'updateTemplate',
      role: 'monster',
      name: 'Goblin',
      update: { ac: 30 },
    });

    expect(next.undo[encounter(state).id]).toHaveLength(1);
    // Undo reverts the synced combatant back to its pre-update state.
    const undone = reducer(next, { type: 'undo' });
    expect(encounter(undone).combatants[0].ac).toBe(0);
  });
});
