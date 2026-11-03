import { describe, expect, it } from 'vitest';
import { parsePcs } from '../src/state/persistence';
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
  cr: 0,
  spellDC: 0,
  notes: '',
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
  cr: 0,
  spellDC: 0,
  notes: '',
};

describe('parsePcs', () => {
  it('parses a wrapped { kind: "pcs", characters } file', () => {
    const json = JSON.stringify({ version: 1, kind: 'pcs', characters: [aria] });
    const result = parsePcs(json);
    expect(result.error).toBeUndefined();
    expect(result.characters).toEqual([aria]);
  });

  it('parses a bare array of characters', () => {
    const json = JSON.stringify([aria, goblin]);
    const result = parsePcs(json);
    expect(result.characters?.map((entry) => entry.name)).toEqual(['Aria']);
  });

  it('returns an error for invalid JSON', () => {
    expect(parsePcs('{ not json')?.error).toBeTruthy();
  });

  it('ignores non-PC characters and errors when none remain', () => {
    const json = JSON.stringify({ kind: 'pcs', characters: [goblin] });
    expect(parsePcs(json).error).toBeTruthy();
    expect(parsePcs(JSON.stringify({ kind: 'pcs', characters: [] }))?.error).toBeTruthy();
    expect(parsePcs(JSON.stringify({ something: 'else' }))?.error).toBeTruthy();
  });
});
