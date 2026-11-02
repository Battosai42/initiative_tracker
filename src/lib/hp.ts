import type { Combatant, SystemId, Track } from '../types';

function clampAmount(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.floor(amount));
}

/** Damage that drains temporary HP before current HP. */
export function hurtTrack(track: Track, amount: number): Track {
  let remaining = clampAmount(amount);
  if (remaining === 0) return track;
  let temp = track.temp;
  if (temp > 0) {
    const absorbed = Math.min(temp, remaining);
    temp -= absorbed;
    remaining -= absorbed;
  }
  return {
    ...track,
    current: Math.max(0, track.current - remaining),
    temp,
  };
}

export function healTrack(track: Track, amount: number): Track {
  return {
    ...track,
    current: Math.min(track.max, track.current + clampAmount(amount)),
  };
}

export function adjustTrack(track: Track, delta: number): Track {
  const value = Math.round(delta);
  return {
    ...track,
    current: Math.max(0, Math.min(track.max, track.current + value)),
  };
}

export function setTrackCurrent(track: Track, current: number): Track {
  return {
    ...track,
    current: Math.max(0, Math.min(track.max, Math.round(current))),
  };
}

function damageBattletech(combatant: Combatant, amount: number): Combatant {
  let remaining = clampAmount(amount);
  const armorAbsorbed = Math.min(combatant.armor.current, remaining);
  remaining -= armorAbsorbed;
  const armor = { ...combatant.armor, current: combatant.armor.current - armorAbsorbed };
  const structure = {
    ...combatant.structure,
    current: Math.max(0, combatant.structure.current - remaining),
  };
  const destroyed = combatant.structure.max > 0 && structure.current <= 0;
  return {
    ...combatant,
    armor,
    structure,
    defeated: destroyed ? true : combatant.defeated,
    conditions:
      destroyed && !combatant.conditions.some((condition) => condition.label === 'Destroyed')
        ? [
            ...combatant.conditions,
            { id: `cond_${Date.now()}_destroyed`, label: 'Destroyed', rounds: null },
          ]
        : combatant.conditions,
  };
}

/**
 * Applies damage using the system's rules:
 * - D&D: temporary HP absorbs first.
 * - Starfinder 1e: Stamina absorbs before HP.
 * - Battletech: armor absorbs before internal structure.
 * - Shadowrun: each monitor is damaged independently (use `adjustTrack`).
 */
export function damageCombatant(
  combatant: Combatant,
  system: SystemId,
  amount: number,
): Combatant {
  const damage = clampAmount(amount);
  if (damage === 0) return combatant;

  if (system === 'battletech') return damageBattletech(combatant, damage);

  if (system === 'starfinder1e' && combatant.secondary.max > 0) {
    const absorbed = Math.min(combatant.secondary.current, damage);
    return {
      ...combatant,
      secondary: { ...combatant.secondary, current: combatant.secondary.current - absorbed },
      hp: hurtTrack(combatant.hp, damage - absorbed),
    };
  }

  return { ...combatant, hp: hurtTrack(combatant.hp, damage) };
}

export function healCombatant(combatant: Combatant, amount: number): Combatant {
  return {
    ...combatant,
    hp: healTrack(combatant.hp, amount),
    deathSaves:
      combatant.hp.current <= 0 && healTrack(combatant.hp, amount).current > 0
        ? { successes: 0, failures: 0 }
        : combatant.deathSaves,
  };
}

/**
 * Applies a creature's HP regeneration: heals `regen` HP up to its max each turn.
 * No-op when there is no regen, the creature is defeated, or HP is already full.
 * Revives from down/dead just like healing does.
 */
export function applyRegeneration(combatant: Combatant): Combatant {
  if (combatant.regen <= 0 || combatant.defeated || combatant.hp.max <= 0) {
    return combatant;
  }
  const healed = healTrack(combatant.hp, combatant.regen);
  const revived =
    combatant.hp.current <= 0 && healed.current > 0
      ? { successes: 0, failures: 0 }
      : combatant.deathSaves;
  return { ...combatant, hp: healed, deathSaves: revived };
}

/** Restores every pool, clears temporary HP, conditions and defeat. */
export function restoreCombatant(combatant: Combatant): Combatant {
  return {
    ...combatant,
    hp: { ...combatant.hp, current: combatant.hp.max, temp: 0 },
    secondary: { ...combatant.secondary, current: combatant.secondary.max, temp: 0 },
    armor: { ...combatant.armor, current: combatant.armor.max, temp: 0 },
    structure: { ...combatant.structure, current: combatant.structure.max, temp: 0 },
    conditions: [],
    defeated: false,
    acted: false,
    heat: 0,
    pilotHits: 0,
    deathSaves: { successes: 0, failures: 0 },
  };
}

export function healthState(combatant: Combatant): 'down' | 'bloodied' | 'healthy' {
  if (combatant.hp.max > 0 && combatant.hp.current <= 0) return 'down';
  if (combatant.hp.max > 0 && combatant.hp.current <= Math.ceil(combatant.hp.max / 2)) {
    return 'bloodied';
  }
  return 'healthy';
}
