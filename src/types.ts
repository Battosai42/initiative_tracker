export type SystemId =
  | 'dnd5e'
  | 'starfinder1e'
  | 'starfinder2e'
  | 'shadowrun'
  | 'battletech'
  | 'generic';

export type Role = 'pc' | 'monster' | 'npc';

export type Disposition = 'friendly' | 'neutral' | 'unfriendly';

export type SaveKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type SavingThrows = Record<SaveKey, number>;

export interface Track {
  current: number;
  max: number;
  temp: number;
}

export interface ConditionInstance {
  id: string;
  label: string;
  /** Remaining rounds, or null for an indefinite condition. */
  rounds: number | null;
}

/**
 * A saved combatant "template" (a.k.a. library entry). It captures the fields
 * needed to re-add the same PC, NPC or monster quickly, without the per-encounter
 * state such as initiative, current HP or conditions.
 */
export interface CombatantTemplate {
  name: string;
  role: Role;
  disposition: Disposition;
  side: string;
  initMod: number;
  tiebreak: number;
  hpMax: number;
  secondaryMax: number;
  resolve: number;
  armor: number;
  structure: number;
  ac: number;
  eac: number;
  kac: number;
  /** PF2e shield value shown beside AC. */
  shield: number;
  /** D&D 5e saving throw modifiers. */
  saves: SavingThrows;
  dr: number;
  sr: number;
  fort: number;
  reflex: number;
  con: number;
  regen: number;
}

export interface Combatant {
  id: string;
  name: string;
  role: Role;
  /** Friendly, neutral, and unfriendly combatants get different card tints and tags. */
  disposition: Disposition;
  side: string;
  initiative: number | null;
  initMod: number;
  tiebreak: number;
  /** D&D Armor Class. */
  ac: number;
  /** Starfinder Energy Armor Class. */
  eac: number;
  /** Starfinder Kinetic Armor Class. */
  kac: number;
  /** PF2e shield value shown beside AC. */
  shield: number;
  /** D&D 5e saving throw modifiers. */
  saves: SavingThrows;
  hp: Track;
  secondary: Track;
  resolve: number;
  conditions: ConditionInstance[];
  notes: string;
  defeated: boolean;
  acted: boolean;
  deathSaves: {
    successes: number;
    failures: number;
  };
  /** Battletech */
  armor: Track;
  structure: Track;
  heat: number;
  pilotHits: number;
  /** Starfinder: damage reduction, spell resistance and saving throws. */
  dr: number;
  sr: number;
  fort: number;
  reflex: number;
  con: number;
  /** Starfinder: monsters heal this much HP at the start of their turn. */
  regen: number;
}

export interface Encounter {
  id: string;
  name: string;
  system: SystemId;
  round: number;
  activeId: string | null;
  combatants: Combatant[];
  /** Battletech side initiative, keyed by side name. */
  sideRolls: Record<string, number | null>;
  btOrder: string[];
  btIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  theme: 'dark' | 'light';
}

export interface AppData {
  version: number;
  encounters: Encounter[];
  activeId: string;
  /**
   * App-wide library of previously-added combatants. Persists across encounters
   * so PCs (and any NPC/monster) can be re-added from the name-field dropdown.
   */
  templates: CombatantTemplate[];
  settings: AppSettings;
}

export const DATA_VERSION = 1;
