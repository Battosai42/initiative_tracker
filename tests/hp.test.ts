import { describe, expect, it } from 'vitest';
import { createCombatant, track } from '../src/lib/factory';
import {
  adjustTrack,
  applyRegeneration,
  damageCombatant,
  healCombatant,
  hurtTrack,
  restoreCombatant,
} from '../src/lib/hp';

describe('track maths', () => {
  it('clamps healing and direct adjustments', () => {
    expect(healCombatant(createCombatant({ hp: track(20, 12) }), 100).hp.current).toBe(20);
    expect(adjustTrack(track(10, 5), -100).current).toBe(0);
    expect(adjustTrack(track(10, 5), 3).current).toBe(8);
  });

  it('drains temporary HP before real HP', () => {
    const trackWithTemp = { ...track(20, 20), temp: 5 };
    expect(hurtTrack(trackWithTemp, 3)).toMatchObject({ current: 20, temp: 2 });
    expect(hurtTrack(trackWithTemp, 8)).toMatchObject({ current: 17, temp: 0 });
  });
});

describe('D&D damage', () => {
  it('uses temp HP first, then HP', () => {
    const hero = createCombatant({ hp: { ...track(20, 20), temp: 5 } });
    const damaged = damageCombatant(hero, 'dnd5e', 8);
    expect(damaged.hp.current).toBe(17);
    expect(damaged.hp.temp).toBe(0);
  });

  it('never drops below zero through the damage helper', () => {
    const hero = createCombatant({ hp: track(10, 4) });
    expect(damageCombatant(hero, 'dnd5e', 40).hp.current).toBe(0);
  });
});

describe('Starfinder stamina', () => {
  it('absorbs damage with stamina before HP', () => {
    const soldier = createCombatant({ hp: track(10, 10), secondary: track(6, 6) });
    const firstHit = damageCombatant(soldier, 'starfinder1e', 8);
    expect(firstHit.secondary.current).toBe(0);
    expect(firstHit.hp.current).toBe(8);

    const secondHit = damageCombatant(firstHit, 'starfinder1e', 3);
    expect(secondHit.secondary.current).toBe(0);
    expect(secondHit.hp.current).toBe(5);
  });

  it('does not route healing through stamina', () => {
    const soldier = createCombatant({ hp: track(10, 4), secondary: track(6, 0) });
    const healed = healCombatant(soldier, 3);
    expect(healed.hp.current).toBe(7);
    expect(healed.secondary.current).toBe(0);
  });
});

describe('HP regeneration', () => {
  it('heals regen each turn up to max, and revives from down/dead', () => {
    const regenerator = createCombatant({ hp: track(10, 2), regen: 4 });
    const healed = applyRegeneration(regenerator);
    expect(healed.hp.current).toBe(6);

    const atMax = applyRegeneration(createCombatant({ hp: track(10, 9), regen: 4 }));
    expect(atMax.hp.current).toBe(10);

    const revived = applyRegeneration(createCombatant({ hp: track(10, 0), regen: 3 }));
    expect(revived.hp.current).toBe(3);
    expect(revived.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it('does nothing without regen, when defeated, or at zero max HP', () => {
    const noRegen = applyRegeneration(createCombatant({ hp: track(10, 3), regen: 0 }));
    expect(noRegen.hp.current).toBe(3);

    const defeated = applyRegeneration(createCombatant({ hp: track(10, 1), regen: 5, defeated: true }));
    expect(defeated.hp.current).toBe(1);

    const zeroMax = applyRegeneration(createCombatant({ hp: track(0, 0), regen: 5 }));
    expect(zeroMax.hp.current).toBe(0);
  });
});

describe('Battletech damage', () => {
  it('strips armor, then structure, then marks the unit destroyed', () => {
    const mech = createCombatant({ armor: track(10, 10), structure: track(5, 5) });
    const hit = damageCombatant(mech, 'battletech', 12);
    expect(hit.armor.current).toBe(0);
    expect(hit.structure.current).toBe(3);
    expect(hit.defeated).toBe(false);

    const destroyed = damageCombatant(hit, 'battletech', 5);
    expect(destroyed.structure.current).toBe(0);
    expect(destroyed.defeated).toBe(true);
    expect(destroyed.conditions.some((condition) => condition.label === 'Destroyed')).toBe(true);
  });
});

describe('restore', () => {
  it('fills every pool and clears conditions and defeat', () => {
    const unit = createCombatant({
      hp: track(12, 0),
      secondary: track(5, 1),
      armor: track(8, 0),
      structure: track(4, 1),
      defeated: true,
      heat: 14,
      pilotHits: 2,
      conditions: [{ id: 'c1', label: 'Prone', rounds: null }],
    });
    const restored = restoreCombatant(unit);
    expect(restored.hp.current).toBe(12);
    expect(restored.secondary.current).toBe(5);
    expect(restored.armor.current).toBe(8);
    expect(restored.structure.current).toBe(4);
    expect(restored.defeated).toBe(false);
    expect(restored.heat).toBe(0);
    expect(restored.pilotHits).toBe(0);
    expect(restored.conditions).toEqual([]);
  });
});
