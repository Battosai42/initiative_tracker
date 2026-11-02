export type SystemId =
  | 'dnd5e'
  | 'starfinder1e'
  | 'starfinder2e'
  | 'shadowrun'
  | 'battletech'
  | 'generic';

export type Role = 'pc' | 'monster' | 'npc';

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

export interface Combatant {
  id: string;
  name: string;
  role: Role;
  side: string;
  initiative: number | null;
  initMod: number;
  tiebreak: number;
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
  settings: AppSettings;
}

export const DATA_VERSION = 1;
