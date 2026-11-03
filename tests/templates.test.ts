import { describe, expect, it } from 'vitest';
import {
  addTemplates,
  combatantToTemplate,
  createCombatant,
  dedupeTemplates,
  normalizeAppData,
} from '../src/lib/factory';
import type { Combatant, CombatantTemplate } from '../src/types';

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
      shield: 0,
      saves: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      dr: 0,
      sr: 0,
      fort: 0,
      reflex: 0,
      con: 0,
      regen: 0,
      cr: 0,
      spellDC: 0,
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

describe('combatant saving throws', () => {
  it('defaults all saving throw modifiers to zero', () => {
    const combatant = createCombatant({ name: 'Draft' });
    expect(combatant.saves).toEqual({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
  });

  it('captures saving throw modifiers in the template', () => {
    const combatant = createCombatant({
      name: 'Aria',
      role: 'pc',
      saves: { str: -1, dex: 5, con: 2, int: 0, wis: 3, cha: -2 },
    });
    expect(combatantToTemplate(combatant).saves).toEqual({
      str: -1,
      dex: 5,
      con: 2,
      int: 0,
      wis: 3,
      cha: -2,
    });
  });

  it('rounds saving throw modifiers and defaults missing values on load', () => {
    const data = normalizeAppData(
      {
        encounters: [
          {
            name: 'A',
            system: 'dnd5e',
            combatants: [
              { name: 'Knight', saves: { str: 2.6, dex: -1.4, con: 4, int: -2, wis: 1, cha: 0 } },
              { name: 'Old Hero' },
            ],
          },
        ],
      },
      true,
    );
    const knight = data?.encounters[0].combatants[0];
    expect(knight?.saves).toEqual({ str: 3, dex: -1, con: 4, int: -2, wis: 1, cha: 0 });
    expect(data?.encounters[0].combatants[1]?.saves).toEqual({
      str: 0,
      dex: 0,
      con: 0,
      int: 0,
      wis: 0,
      cha: 0,
    });
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

  it('defaults CR and Spell DC to zero', () => {
    const combatant = createCombatant({ name: 'Draft' });
    expect(combatant.cr).toBe(0);
    expect(combatant.spellDC).toBe(0);
  });

  it('captures CR and Spell DC in the template', () => {
    const monster = createCombatant({
      name: 'Lich',
      role: 'monster',
      cr: 18,
      spellDC: 17,
    });
    const template = combatantToTemplate(monster);
    expect(template).toMatchObject({ cr: 18, spellDC: 17 });
  });

  it('clamps negative CR and rounds Spell DC on load', () => {
    const data = normalizeAppData(
      {
        encounters: [
          {
            name: 'A',
            system: 'starfinder1e',
            combatants: [{ name: 'Caster', cr: -3, spellDC: 12.6 }],
          },
        ],
      },
      true,
    );
    const caster = data?.encounters[0].combatants[0];
    expect(caster?.cr).toBe(0);
    expect(caster?.spellDC).toBe(13);
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
        shield: 0,
        saves: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        dr: 0,
        sr: 0,
        fort: 0,
        reflex: 0,
        con: 0,
        regen: 0,
        cr: 0,
        spellDC: 0,
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

describe('addTemplates', () => {
  const goblin: Combatant = createCombatant({
    name: 'Goblin',
    role: 'monster',
    disposition: 'unfriendly',
    side: 'OpFor',
    hp: { current: 4, max: 10, temp: 0 },
  });
  const orc: Combatant = createCombatant({
    name: 'Orc',
    role: 'monster',
    disposition: 'unfriendly',
    side: 'OpFor',
    hp: { current: 6, max: 12, temp: 0 },
  });

  it('adds a template for each imported combatant', () => {
    const result = addTemplates([], [goblin, orc]);
    expect(result.map((entry) => entry.name)).toEqual(['Goblin', 'Orc']);
  });

  it('does not mutate the existing template list', () => {
    const existing: CombatantTemplate[] = [combatantToTemplate(goblin)];
    const snapshot = [...existing];
    addTemplates(existing, [orc]);
    expect(existing).toEqual(snapshot);
  });

  it('skips combatants whose (role, name) already exists', () => {
    const existing = [combatantToTemplate(goblin)];
    const result = addTemplates(existing, [goblin, orc]);
    expect(result.map((entry) => entry.name)).toEqual(['Goblin', 'Orc']);
  });

  it('dedupes repeated combatants within the imported set', () => {
    const result = addTemplates([], [goblin, goblin, orc]);
    expect(result.map((entry) => entry.name)).toEqual(['Goblin', 'Orc']);
  });
});

describe('dedupeTemplates', () => {
  const goblin = combatantToTemplate(
    createCombatant({ name: 'Goblin', role: 'monster', disposition: 'unfriendly' }),
  );
  const orc = combatantToTemplate(
    createCombatant({ name: 'Orc', role: 'monster', disposition: 'unfriendly' }),
  );

  it('leaves a clean list untouched', () => {
    const result = dedupeTemplates([goblin, orc]);
    expect(result.map((entry) => entry.name)).toEqual(['Goblin', 'Orc']);
  });

  it('removes duplicate (role, name) entries, keeping the first', () => {
    const result = dedupeTemplates([goblin, orc, { ...goblin, hpMax: 99 }]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(goblin);
  });

  it('treats the same name with different roles as distinct', () => {
    const pcGoblin = { ...goblin, role: 'pc' as const };
    const result = dedupeTemplates([goblin, pcGoblin]);
    expect(result.map((entry) => entry.role)).toEqual(['monster', 'pc']);
  });

  it('does not mutate the input list', () => {
    const input = [goblin, orc, goblin];
    const snapshot = [...input];
    dedupeTemplates(input);
    expect(input).toEqual(snapshot);
  });
});
