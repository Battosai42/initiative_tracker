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
    });
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
