import type {
  BtAttackerMovement,
  BtRange,
  BtTargetMovement,
  Combatant,
  GatorState,
} from '../types';

export interface GatorOption<T extends string> {
  value: T;
  label: string;
  modifier: number;
}

export const ATTACKER_MOVEMENT_OPTIONS: Array<GatorOption<BtAttackerMovement>> = [
  { value: 'stationary', label: 'Stationary', modifier: 0 },
  { value: 'walked', label: 'Walked', modifier: 1 },
  { value: 'ran', label: 'Ran', modifier: 2 },
  { value: 'jumped', label: 'Jumped', modifier: 3 },
];

export const TARGET_MOVEMENT_OPTIONS: Array<GatorOption<BtTargetMovement>> = [
  { value: '0-2', label: '0–2', modifier: 0 },
  { value: '3-4', label: '3–4', modifier: 1 },
  { value: '5-6', label: '5–6', modifier: 2 },
  { value: '7-9', label: '7–9', modifier: 3 },
  { value: '10-17', label: '10–17', modifier: 4 },
  { value: '18-24', label: '18–24', modifier: 5 },
  { value: '25+', label: '25+', modifier: 6 },
];

export const RANGE_OPTIONS: Array<GatorOption<BtRange>> = [
  { value: 'short', label: 'Short', modifier: 0 },
  { value: 'medium', label: 'Medium', modifier: 2 },
  { value: 'long', label: 'Long', modifier: 4 },
  { value: 'extreme', label: 'Extreme', modifier: 6 },
];

export function createGatorState(): GatorState {
  return {
    attackerMovement: 'stationary',
    targetMovement: '0-2',
    targetJumped: false,
    targetImmobile: false,
    range: 'short',
    other: 0,
    useHeat: true,
    usePilotHits: true,
    usePilotingDamage: true,
  };
}

/** Classic BattleTech heat modifiers to weapon attacks. */
export function heatModifier(heat: number): number {
  if (heat >= 24) return 4;
  if (heat >= 17) return 3;
  if (heat >= 13) return 2;
  if (heat >= 8) return 1;
  return 0;
}

export function attackerMovementModifier(movement: BtAttackerMovement): number {
  return ATTACKER_MOVEMENT_OPTIONS.find((option) => option.value === movement)?.modifier ?? 0;
}

export function targetMovementModifier(gator: GatorState): number {
  if (gator.targetImmobile) return -4;
  const base =
    TARGET_MOVEMENT_OPTIONS.find((option) => option.value === gator.targetMovement)?.modifier ?? 0;
  return base + (gator.targetJumped ? 1 : 0);
}

export function rangeModifier(range: BtRange): number {
  return RANGE_OPTIONS.find((option) => option.value === range)?.modifier ?? 0;
}

export interface GatorBreakdown {
  gunnery: number;
  attacker: number;
  target: number;
  other: number;
  range: number;
  heat: number;
  pilotHits: number;
  total: number;
}

/**
 * Add the five GATOR components. Heat and pilot hits are part of "Other", but
 * are broken out so the card can show where the modifier came from.
 */
export function gatorBreakdown(
  combatant: Pick<Combatant, 'gunnery' | 'heat' | 'pilotHits' | 'gator'>,
): GatorBreakdown {
  const gator = combatant.gator;
  const heat = gator.useHeat ? heatModifier(combatant.heat) : 0;
  const pilotHits = gator.usePilotHits ? Math.max(0, Math.round(combatant.pilotHits)) : 0;
  const other = Math.round(gator.other) + heat + pilotHits;
  const attacker = attackerMovementModifier(gator.attackerMovement);
  const target = targetMovementModifier(gator);
  const range = rangeModifier(gator.range);
  return {
    gunnery: combatant.gunnery,
    attacker,
    target,
    other,
    range,
    heat,
    pilotHits,
    total: combatant.gunnery + attacker + target + other + range,
  };
}

/**
 * Damage modifier for a Piloting Skill Roll: +1 for every 20 points of damage
 * a 'Mech has taken (20-39: +1, 40-59: +2, 60-79: +3, 80+: +4). Based on the
 * total armor + structure damage across all hit locations.
 */
export function pilotingDamageModifier(totalDamage: number): number {
  return Math.min(4, Math.max(0, Math.floor(totalDamage / 20)));
}

export interface PilotingBreakdown {
  piloting: number;
  damage: number;
  other: number;
  total: number;
}

/**
 * Target number for a Piloting Skill Roll: base Piloting skill plus the damage
 * modifier (per the PSR table) and the manual "Other" modifiers (terrain,
 * destroyed actuators and similar). Heat and pilot-hit modifiers only apply to
 * weapon attacks, so they are not included here.
 */
export function pilotingBreakdown(
  combatant: Pick<Combatant, 'piloting' | 'gator'>,
  damageModifier: number,
): PilotingBreakdown {
  const other = Math.round(combatant.gator.other);
  const damage = combatant.gator.usePilotingDamage ? damageModifier : 0;
  return {
    piloting: combatant.piloting,
    damage,
    other,
    total: combatant.piloting + damage + other,
  };
}

/** Exact chance of rolling at least `target` on 2d6, as a whole percentage. */
export function twoDiceOdds(target: number): number {
  if (target <= 2) return 100;
  if (target > 12) return 0;
  const ways = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
  let favorable = 0;
  for (let sum = 2; sum <= 12; sum += 1) {
    if (sum >= target) favorable += ways[sum - 2] ?? 0;
  }
  return Math.round((favorable / 36) * 100);
}

/** Compact signed modifier, e.g. +2, -4 or 0. */
export function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
