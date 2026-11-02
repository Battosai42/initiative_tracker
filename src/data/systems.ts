import type { SystemId } from '../types';
import { conditionPresets } from './conditions';

export type InitiativeMode = 'd20' | 'shadowrun' | 'side' | 'manual';
export type DamageOrder = 'hp' | 'secondary-first' | 'none';

export interface SystemPreset {
  id: SystemId;
  name: string;
  short: string;
  accent: string;
  initiative: InitiativeMode;
  primaryLabel: string;
  secondaryLabel: string | null;
  showResolve: boolean;
  showTempHp: boolean;
  showDeathSaves: boolean;
  showBattletech: boolean;
  damageOrder: DamageOrder;
  initHint: string;
  blurb: string;
  conditions: string[];
}

export const SYSTEMS: Record<SystemId, SystemPreset> = {
  dnd5e: {
    id: 'dnd5e',
    name: 'Dungeons & Dragons 5e',
    short: 'D&D 5e',
    accent: '#e05d44',
    initiative: 'd20',
    primaryLabel: 'HP',
    secondaryLabel: null,
    showResolve: false,
    showTempHp: true,
    showDeathSaves: true,
    showBattletech: false,
    damageOrder: 'hp',
    initHint: 'd20 + DEX modifier',
    blurb: 'HP, temporary hit points, conditions and death saves.',
    conditions: conditionPresets('dnd5e'),
  },
  starfinder1e: {
    id: 'starfinder1e',
    name: 'Starfinder 1e',
    short: 'Starfinder 1e',
    accent: '#3fa9ff',
    initiative: 'd20',
    primaryLabel: 'HP',
    secondaryLabel: 'Stamina',
    showResolve: true,
    showTempHp: false,
    showDeathSaves: false,
    showBattletech: false,
    damageOrder: 'secondary-first',
    initHint: 'd20 + DEX modifier',
    blurb: 'Stamina drains first, then HP. Tracks Resolve Points too.',
    conditions: conditionPresets('starfinder1e'),
  },
  starfinder2e: {
    id: 'starfinder2e',
    name: 'Starfinder 2e / Pathfinder 2e',
    short: 'SF2e / PF2e',
    accent: '#9b7bff',
    initiative: 'd20',
    primaryLabel: 'HP',
    secondaryLabel: null,
    showResolve: false,
    showTempHp: false,
    showDeathSaves: false,
    showBattletech: false,
    damageOrder: 'hp',
    initHint: 'd20 + Perception modifier',
    blurb: 'HP with PF2e-style conditions such as wounded and dying.',
    conditions: conditionPresets('starfinder2e'),
  },
  shadowrun: {
    id: 'shadowrun',
    name: 'Shadowrun 5e / 6e',
    short: 'Shadowrun',
    accent: '#35d07f',
    initiative: 'shadowrun',
    primaryLabel: 'Physical',
    secondaryLabel: 'Stun',
    showResolve: false,
    showTempHp: false,
    showDeathSaves: false,
    showBattletech: false,
    damageOrder: 'hp',
    initHint: 'Reaction + Intuition + 1d6',
    blurb: 'Physical and Stun monitors with initiative passes.',
    conditions: conditionPresets('shadowrun'),
  },
  battletech: {
    id: 'battletech',
    name: 'Battletech',
    short: 'Battletech',
    accent: '#f0a63a',
    initiative: 'side',
    primaryLabel: 'Armor',
    secondaryLabel: 'Structure',
    showResolve: false,
    showTempHp: false,
    showDeathSaves: false,
    showBattletech: true,
    damageOrder: 'none',
    initHint: '2d6 per side, alternating activation',
    blurb: 'Side-based initiative, armor and structure, heat and pilot hits.',
    conditions: conditionPresets('battletech'),
  },
  generic: {
    id: 'generic',
    name: 'Generic / custom',
    short: 'Generic',
    accent: '#9aa4b2',
    initiative: 'd20',
    primaryLabel: 'HP',
    secondaryLabel: 'Pool',
    showResolve: false,
    showTempHp: false,
    showDeathSaves: false,
    showBattletech: false,
    damageOrder: 'hp',
    initHint: 'd20 + modifier',
    blurb: 'A flexible HP tracker with one extra resource pool.',
    conditions: conditionPresets('generic'),
  },
};

export const SYSTEM_LIST: SystemPreset[] = Object.values(SYSTEMS);

export function getSystem(id: SystemId): SystemPreset {
  return SYSTEMS[id] ?? SYSTEMS.generic;
}
