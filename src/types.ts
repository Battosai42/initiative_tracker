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

/** A user-defined stat shown on a combatant card and stored in its template. */
export interface CustomStat {
  id: string;
  label: string;
  value: string;
  /** When true, show the stat on the collapsed card as well as when expanded. */
  showInCollapsed: boolean;
}

/** BattleTech attacker movement choices and their to-hit modifiers. */
export type BtAttackerMovement = 'stationary' | 'walked' | 'ran' | 'jumped';

/** BattleTech target movement brackets and their to-hit modifiers. */
export type BtTargetMovement = '0-2' | '3-4' | '5-6' | '7-9' | '10-17' | '18-24' | '25+';

/** BattleTech range brackets and their to-hit modifiers. */
export type BtRange = 'short' | 'medium' | 'long' | 'extreme';

/**
 * The GATOR selections for one BattleTech attack. These are per-combatant and
 * reset only when the player changes them; they are not copied into templates.
 */
export interface GatorState {
  attackerMovement: BtAttackerMovement;
  targetMovement: BtTargetMovement;
  targetJumped: boolean;
  targetImmobile: boolean;
  range: BtRange;
  /** Terrain, partial cover, minimum range, damage and other manual modifiers. */
  other: number;
  /** Include the combatant's current heat modifier in the total. */
  useHeat: boolean;
  /** Include one modifier per pilot hit in the total. */
  usePilotHits: boolean;
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
  /** Battletech: base Gunnery and Piloting skills. */
  gunnery: number;
  piloting: number;
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
  /** Starfinder: Combatant Rating (a monster's challenge rating). */
  cr: number;
  /** Starfinder: the spell save DC. */
  spellDC: number;
  /** Free-form notes carried from the combatant card. */
  notes: string;
  /** User-defined stats, e.g. Speed, Ammo or Damage. */
  customStats: CustomStat[];
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
  /** Battletech: base Gunnery and Piloting skills. */
  gunnery: number;
  piloting: number;
  /** Battletech: current GATOR attack selections. */
  gator: GatorState;
  /** Starfinder: damage reduction, spell resistance and saving throws. */
  dr: number;
  sr: number;
  fort: number;
  reflex: number;
  con: number;
  /** Starfinder: monsters heal this much HP at the start of their turn. */
  regen: number;
  /** Starfinder: Combatant Rating (a monster's challenge rating). */
  cr: number;
  /** Starfinder: the spell save DC. */
  spellDC: number;
  /** User-defined stats, e.g. Speed, Ammo or Damage. */
  customStats: CustomStat[];
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
