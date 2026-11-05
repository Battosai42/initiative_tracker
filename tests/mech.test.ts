import { describe, expect, it } from 'vitest';
import type { BtLocation, BtLocationId, BtLocations, Combatant } from '../src/types';
import { createCombatant, normalizeCombatant, track } from '../src/lib/factory';
import {
  BT_LOCATION_IDS,
  btLocationTotals,
  createBtLocations,
  damageBtLocation,
  healBtLocation,
  setBtLocationCurrent,
  setBtLocationMax,
} from '../src/lib/mech';

function loc(armor: number, structure: number): BtLocation {
  return { armor: track(armor), structure: track(structure), destroyed: false };
}

function mech(locations: Partial<BtLocations> = {}): Combatant {
  return createCombatant({
    locations: { ...createBtLocations(), ...locations },
  });
}

describe('BattleTech hit locations', () => {
  it('splits aggregate armor and structure into locations that add back up', () => {
    const locations = createBtLocations(40, 20);
    const totals = btLocationTotals(locations);
    expect(totals.armor).toMatchObject({ current: 40, max: 40 });
    expect(totals.structure).toMatchObject({ current: 20, max: 20 });

    const damaged = createBtLocations(40, 20, 30, 9);
    const damagedTotals = btLocationTotals(damaged);
    expect(damagedTotals.armor).toMatchObject({ current: 30, max: 40 });
    expect(damagedTotals.structure).toMatchObject({ current: 9, max: 20 });
  });

  it('keeps mirrored left and right limits identical for any total', () => {
    const pairs: Array<[BtLocationId, BtLocationId]> = [
      ['leftArm', 'rightArm'],
      ['leftTorso', 'rightTorso'],
      ['leftLeg', 'rightLeg'],
    ];

    for (let total = 0; total <= 80; total += 1) {
      const locations = createBtLocations(total, total);
      const totals = btLocationTotals(locations);
      expect(totals.armor.max).toBe(total);
      expect(totals.structure.max).toBe(total);

      for (const [left, right] of pairs) {
        expect(locations[left].armor.max).toBe(locations[right].armor.max);
        expect(locations[left].structure.max).toBe(locations[right].structure.max);
      }
    }
  });

  it('keeps current totals exact without exceeding any location limit', () => {
    for (let total = 0; total <= 40; total += 3) {
      for (let current = 0; current <= total; current += 2) {
        const locations = createBtLocations(total, total, current, current);
        const totals = btLocationTotals(locations);
        expect(totals.armor.current).toBe(current);
        expect(totals.structure.current).toBe(current);

        for (const id of BT_LOCATION_IDS) {
          expect(locations[id].armor.current).toBeLessThanOrEqual(
            locations[id].armor.max,
          );
          expect(locations[id].structure.current).toBeLessThanOrEqual(
            locations[id].structure.max,
          );
        }
      }
    }
  });

  it('drains a location armor before its structure', () => {
    const unit = mech({ leftArm: loc(5, 3) });
    const hit = damageBtLocation(unit, 'leftArm', 8);

    expect(hit.locations.leftArm.armor.current).toBe(0);
    expect(hit.locations.leftArm.structure.current).toBe(0);
    expect(hit.locations.leftArm.destroyed).toBe(true);
    expect(hit.armor).toMatchObject({ current: 0, max: 5 });
    expect(hit.structure).toMatchObject({ current: 0, max: 3 });
  });

  it('transfers arm overflow to the side torso and then to the center torso', () => {
    const unit = mech({
      leftArm: loc(2, 3),
      leftTorso: loc(4, 5),
      centerTorso: loc(6, 5),
    });

    const throughArm = damageBtLocation(unit, 'leftArm', 7);
    expect(throughArm.locations.leftArm.destroyed).toBe(true);
    expect(throughArm.locations.leftTorso.armor.current).toBe(2);
    expect(throughArm.locations.leftTorso.structure.current).toBe(5);

    const throughTorso = damageBtLocation(unit, 'leftArm', 17);
    expect(throughTorso.locations.leftTorso.destroyed).toBe(true);
    expect(throughTorso.locations.centerTorso.armor.current).toBe(3);
    expect(throughTorso.locations.centerTorso.structure.current).toBe(5);
  });

  it('blows off the arm when the side torso is destroyed', () => {
    const unit = mech({
      leftTorso: loc(0, 2),
      leftArm: loc(10, 8),
    });

    const hit = damageBtLocation(unit, 'leftTorso', 2);
    expect(hit.locations.leftTorso.destroyed).toBe(true);
    expect(hit.locations.leftArm.destroyed).toBe(true);
    expect(hit.locations.leftArm.armor.current).toBe(0);
    expect(hit.locations.leftArm.structure.current).toBe(0);
  });

  it('skips an already destroyed limb and passes the hit inward', () => {
    const unit = mech({
      leftArm: loc(0, 2),
      leftTorso: loc(3, 3),
    });

    const first = damageBtLocation(unit, 'leftArm', 2);
    expect(first.locations.leftArm.destroyed).toBe(true);

    const second = damageBtLocation(first, 'leftArm', 2);
    expect(second.locations.leftArm.destroyed).toBe(true);
    expect(second.locations.leftTorso.armor.current).toBe(1);
  });

  it('destroys the unit when the center torso or head is destroyed', () => {
    const centerTorso = mech({ centerTorso: loc(2, 3) });
    const killedByTorso = damageBtLocation(centerTorso, 'centerTorso', 5);
    expect(killedByTorso.locations.centerTorso.destroyed).toBe(true);
    expect(killedByTorso.defeated).toBe(true);
    expect(
      killedByTorso.conditions.some((condition) => condition.label === 'Destroyed'),
    ).toBe(true);

    const head = mech({ head: loc(3, 3) });
    const killedByHead = damageBtLocation(head, 'head', 6);
    expect(killedByHead.defeated).toBe(true);
  });

  it('repairs structure before armor', () => {
    const unit = mech({ leftArm: loc(5, 3) });
    const damaged = damageBtLocation(unit, 'leftArm', 8);
    const healed = healBtLocation(damaged, 'leftArm', 4);

    expect(healed.locations.leftArm.structure.current).toBe(3);
    expect(healed.locations.leftArm.armor.current).toBe(1);
    expect(healed.locations.leftArm.destroyed).toBe(false);
  });

  it('migrates legacy aggregate armor and structure into locations', () => {
    const unit = normalizeCombatant({
      armor: { current: 8, max: 10 },
      structure: { current: 3, max: 5 },
    });
    const totals = btLocationTotals(unit.locations);

    expect(totals.armor).toMatchObject({ current: 8, max: 10 });
    expect(totals.structure).toMatchObject({ current: 3, max: 5 });
  });

  it('repairs legacy sets of empty locations from the aggregate totals', () => {
    const emptyLocations = Object.fromEntries(
      Object.keys(createBtLocations()).map((id) => [
        id,
        { armor: { current: 0, max: 0 }, structure: { current: 0, max: 0 } },
      ]),
    );
    const unit = normalizeCombatant({
      armor: { current: 30, max: 40 },
      structure: { current: 10, max: 20 },
      locations: emptyLocations,
    });
    const totals = btLocationTotals(unit.locations);

    expect(totals.armor).toMatchObject({ current: 30, max: 40 });
    expect(totals.structure).toMatchObject({ current: 10, max: 20 });
  });

  it('fills newly added location limits', () => {
    const unit = createCombatant();
    const next = setBtLocationMax(unit, 'centerTorso', 'armor', 12);

    expect(next.locations.centerTorso.armor).toMatchObject({ current: 12, max: 12 });
    expect(next.armor).toMatchObject({ current: 12, max: 12 });
  });

  it('sets a location pool current value directly and keeps totals in sync', () => {
    const unit = mech({ leftArm: loc(5, 3) });
    const next = setBtLocationCurrent(unit, 'leftArm', 'armor', 2);

    expect(next.locations.leftArm.armor.current).toBe(2);
    expect(next.locations.leftArm.structure.current).toBe(3);
    expect(next.armor).toMatchObject({ current: 2, max: 5 });
  });

  it('clamps direct location values and restores a destroyed location', () => {
    const unit = mech({ leftArm: loc(5, 3) });
    const wrecked = damageBtLocation(unit, 'leftArm', 8);
    const repaired = setBtLocationCurrent(wrecked, 'leftArm', 'structure', 3);
    const clamped = setBtLocationCurrent(unit, 'leftArm', 'armor', 99);

    expect(repaired.locations.leftArm.destroyed).toBe(false);
    expect(repaired.locations.leftArm.structure.current).toBe(3);
    expect(clamped.locations.leftArm.armor.current).toBe(5);
  });

  it('assigns a value to an empty location and raises its limit to match', () => {
    const unit = createCombatant();
    expect(unit.locations.leftArm.armor).toMatchObject({ current: 0, max: 0 });

    const next = setBtLocationCurrent(unit, 'leftArm', 'armor', 8);

    expect(next.locations.leftArm.armor).toMatchObject({ current: 8, max: 8 });
    expect(next.armor).toMatchObject({ current: 8, max: 8 });
  });
});
