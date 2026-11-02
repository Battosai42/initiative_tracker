import { describe, expect, it } from 'vitest';
import {
  combatantToTemplate,
  createCombatant,
  normalizeAppData,
} from '../src/lib/factory';
import type { CombatantTemplate } from '../src/types';

describe('combatantToTemplate', () => {
  it('captures the fields needed to re-add a combatant', () => {
    const combatant = createCombatant({
      name: 'Goblin',
      role: 'monster',
      disposition: 'unfriendly',
      side: 'OpFor',
      initMod: 3,
      tiebreak: 1,
      hp: { current: 4, max: 10, temp: 0 },
      secondary: { current: 0, max: 5, temp: 0 },
      resolve: 3,
      armor: { current: 0, max: 10, temp: 0 },
      structure: { current: 0, max: 5, temp: 0 },
      ac: 15,
      eac: 12,
      kac: 14,
    });
    expect(combatantToTemplate(combatant)).toEqual<CombatantTemplate>({
      name: 'Goblin',
      role: 'monster',
      disposition: 'unfriendly',
      side: 'OpFor',
      initMod: 3,
      tiebreak: 1,
      hpMax: 10,
      secondaryMax: 5,
      resolve: 3,
      armor: 10,
      structure: 5,
      ac: 15,
      eac: 12,
      kac: 14,
      dr: 0,
      sr: 0,
      fort: 0,
      reflex: 0,
      con: 0,
      regen: 0,
    });
  });
});

describe('combatant AC fields', () => {
  it('defaults AC/EAC/KAC to zero', () => {
    const combatant = createCombatant({ name: 'Draft' });
    expect(combatant.ac).toBe(0);
    expect(combatant.eac).toBe(0);
    expect(combatant.kac).toBe(0);
  });

  it('rounds and clamps negative armor class values on load', () => {
    const data = normalizeAppData(
      {
        encounters: [
          {
            name: 'A',
            system: 'dnd5e',
            combatants: [{ name: 'Knight', ac: 18, eac: 15, kac: -3 }],
          },
        ],
      },
      true,
    );
    const knight = data?.encounters[0].combatants[0];
    expect(knight?.ac).toBe(18);
    expect(knight?.eac).toBe(15);
    expect(knight?.kac).toBe(0);
  });
});

describe('combatant Starfinder stats', () => {
  it('captures DR, SR, saving throws and regen in the template', () => {
    const monster = createCombatant({
      name: 'Ogre',
      role: 'monster',
      dr: 5,
      sr: 15,
      fort: 7,
      reflex: -2,
      con: 3,
      regen: 5,
    });
    const template = combatantToTemplate(monster);
    expect(template).toMatchObject({
      dr: 5,
      sr: 15,
      fort: 7,
      reflex: -2,
      con: 3,
      regen: 5,
    });
  });

  it('defaults the extra stats to zero', () => {
    const combatant = createCombatant({ name: 'Draft' });
    expect(combatant.dr).toBe(0);
    expect(combatant.sr).toBe(0);
    expect(combatant.fort).toBe(0);
    expect(combatant.reflex).toBe(0);
    expect(combatant.con).toBe(0);
    expect(combatant.regen).toBe(0);
  });

  it('clamps negative DR/SR/regen and rounds saving throws on load', () => {
    const data = normalizeAppData(
      {
        encounters: [
          {
            name: 'A',
            system: 'starfinder1e',
            combatants: [
              { name: 'Dragon', dr: -1, sr: -4, regen: -2, fort: 4.4, reflex: -1.6, con: 2.5 },
            ],
          },
        ],
      },
      true,
    );
    const dragon = data?.encounters[0].combatants[0];
    expect(dragon?.dr).toBe(0);
    expect(dragon?.sr).toBe(0);
    expect(dragon?.regen).toBe(0);
    expect(dragon?.fort).toBe(4);
    expect(dragon?.reflex).toBe(-2);
    expect(dragon?.con).toBe(3);
  });
});

describe('normalizeAppData templates', () => {
  it('defaults to an empty list when no templates are saved', () => {
    const data = normalizeAppData({ encounters: [{ name: 'A' }] }, true);
    expect(data?.templates).toEqual([]);
  });

  it('preserves well-formed templates', () => {
    const templates: CombatantTemplate[] = [
      {
        name: 'Aria',
        role: 'pc',
        disposition: 'friendly',
        side: 'Players',
        initMod: 2,
        tiebreak: 0,
        hpMax: 32,
        secondaryMax: 0,
        resolve: 3,
        armor: 0,
        structure: 0,
        ac: 12,
        eac: 0,
        kac: 0,
        dr: 0,
        sr: 0,
        fort: 0,
        reflex: 0,
        con: 0,
        regen: 0,
      },
    ];
    const data = normalizeAppData({ encounters: [{ name: 'A' }], templates }, true);
    expect(data?.templates).toEqual(templates);
  });

  it('drops malformed templates and clamps out-of-range numbers', () => {
    const data = normalizeAppData(
      {
        encounters: [{ name: 'A' }],
        templates: [
          { name: '', role: 'npc' },
          { name: '  ', role: 'monster', hpMax: -5, armor: 999 },
          { name: 'Valid', role: 'pc', hpMax: 12 },
        ] as unknown[],
      },
      true,
    );
    expect(data?.templates.map((entry) => entry.name)).toEqual(['Valid']);
    expect(data?.templates[0]?.hpMax).toBe(12);
    expect(data?.templates[0]?.armor).toBe(0);
  });
});
