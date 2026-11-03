import { describe, expect, it } from 'vitest';
import { collectExportablePcs, createCombatant } from '../src/lib/factory';
import type { CombatantTemplate } from '../src/types';

const aria: CombatantTemplate = {
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
};

const goblin: CombatantTemplate = {
  name: 'Goblin',
  role: 'monster',
  disposition: 'unfriendly',
  side: 'OpFor',
  initMod: 1,
  tiebreak: 0,
  hpMax: 7,
  secondaryMax: 0,
  resolve: 0,
  armor: 0,
  structure: 0,
  ac: 10,
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
};

describe('collectExportablePcs', () => {
  it('returns an empty list when there are no PCs', () => {
    expect(collectExportablePcs([], [])).toEqual([]);
    expect(
      collectExportablePcs([goblin], [createCombatant({ name: 'Goblin', role: 'monster' })]),
    ).toEqual([]);
  });

  it('exports PCs from the library', () => {
    expect(collectExportablePcs([aria, goblin], []).map((entry) => entry.name)).toEqual(['Aria']);
  });

  it('exports PCs that live only in the encounter', () => {
    const cade = createCombatant({ name: 'Cade', role: 'pc', hp: { current: 28, max: 28, temp: 0 }, secondary: { current: 0, max: 0, temp: 0 }, resolve: 2, armor: { current: 0, max: 0, temp: 0 }, structure: { current: 0, max: 0, temp: 0 } });
    const boss = createCombatant({ name: 'Boss', role: 'monster' });
    const pcs = collectExportablePcs([aria], [cade, boss]);
    expect(pcs.map((entry) => entry.name)).toEqual(['Aria', 'Cade']);
  });

  it('de-duplicates PCs present in both the library and the encounter', () => {
    const cade = createCombatant({ name: 'Cade', role: 'pc', hp: { current: 28, max: 28, temp: 0 }, secondary: { current: 0, max: 0, temp: 0 }, resolve: 2, armor: { current: 0, max: 0, temp: 0 }, structure: { current: 0, max: 0, temp: 0 } });
    const pcs = collectExportablePcs([aria], [cade]);
    expect(pcs.map((entry) => entry.name)).toEqual(['Aria', 'Cade']);
    const ariaCombatant = createCombatant({ name: 'Aria', role: 'pc', hp: { current: 32, max: 32, temp: 0 }, secondary: { current: 0, max: 0, temp: 0 }, resolve: 3, armor: { current: 0, max: 0, temp: 0 }, structure: { current: 0, max: 0, temp: 0 } });
    const dup = collectExportablePcs([aria], [ariaCombatant]);
    expect(dup.map((entry) => entry.name)).toEqual(['Aria']);
  });
});
