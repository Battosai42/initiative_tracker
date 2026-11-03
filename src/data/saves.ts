import type { SavingThrows, SaveKey } from '../types';

export const SAVE_KEYS: SaveKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const SAVE_INFO: Record<SaveKey, { label: string; title: string }> = {
  str: { label: 'Str', title: 'Strength saving throw' },
  dex: { label: 'Dex', title: 'Dexterity saving throw' },
  con: { label: 'Con', title: 'Constitution saving throw' },
  int: { label: 'Int', title: 'Intelligence saving throw' },
  wis: { label: 'Wis', title: 'Wisdom saving throw' },
  cha: { label: 'Cha', title: 'Charisma saving throw' },
};

export function defaultSaves(): SavingThrows {
  return { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
}

/** String drafts keep negative modifiers editable without fighting number inputs. */
export function savesToDrafts(saves?: Partial<SavingThrows>): Record<SaveKey, string> {
  const values = { ...defaultSaves(), ...saves };
  return {
    str: String(values.str),
    dex: String(values.dex),
    con: String(values.con),
    int: String(values.int),
    wis: String(values.wis),
    cha: String(values.cha),
  };
}
