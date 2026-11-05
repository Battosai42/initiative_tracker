import { describe, expect, it } from 'vitest';
import {
  attackerMovementModifier,
  createGatorState,
  gatorBreakdown,
  heatModifier,
  pilotingBreakdown,
  pilotingDamageModifier,
  rangeModifier,
  signed,
  targetMovementModifier,
  twoDiceOdds,
} from '../src/lib/gator';
import type { GatorState } from '../src/types';

function gator(partial: Partial<GatorState> = {}): GatorState {
  return { ...createGatorState(), ...partial };
}

describe('createGatorState', () => {
  it('starts from a clean stationary short-range shot', () => {
    expect(createGatorState()).toEqual({
      attackerMovement: 'stationary',
      targetMovement: '0-2',
      targetJumped: false,
      targetImmobile: false,
      range: 'short',
      other: 0,
      useHeat: true,
      usePilotHits: true,
      usePilotingDamage: true,
    });
  });
});

describe('heatModifier', () => {
  it('steps at the classic heat breakpoints', () => {
    expect(heatModifier(0)).toBe(0);
    expect(heatModifier(7)).toBe(0);
    expect(heatModifier(8)).toBe(1);
    expect(heatModifier(12)).toBe(1);
    expect(heatModifier(13)).toBe(2);
    expect(heatModifier(16)).toBe(2);
    expect(heatModifier(17)).toBe(3);
    expect(heatModifier(23)).toBe(3);
    expect(heatModifier(24)).toBe(4);
    expect(heatModifier(40)).toBe(4);
  });
});

describe('attackerMovementModifier', () => {
  it('maps each movement mode to its modifier', () => {
    expect(attackerMovementModifier('stationary')).toBe(0);
    expect(attackerMovementModifier('walked')).toBe(1);
    expect(attackerMovementModifier('ran')).toBe(2);
    expect(attackerMovementModifier('jumped')).toBe(3);
  });
});

describe('targetMovementModifier', () => {
  it('maps each movement bracket to its modifier', () => {
    expect(targetMovementModifier(gator({ targetMovement: '0-2' }))).toBe(0);
    expect(targetMovementModifier(gator({ targetMovement: '3-4' }))).toBe(1);
    expect(targetMovementModifier(gator({ targetMovement: '5-6' }))).toBe(2);
    expect(targetMovementModifier(gator({ targetMovement: '7-9' }))).toBe(3);
    expect(targetMovementModifier(gator({ targetMovement: '10-17' }))).toBe(4);
    expect(targetMovementModifier(gator({ targetMovement: '18-24' }))).toBe(5);
    expect(targetMovementModifier(gator({ targetMovement: '25+' }))).toBe(6);
  });

  it('adds one for a jumping target', () => {
    expect(targetMovementModifier(gator({ targetMovement: '5-6', targetJumped: true }))).toBe(3);
  });

  it('uses the immobile modifier instead of movement', () => {
    expect(
      targetMovementModifier(
        gator({ targetMovement: '25+', targetJumped: true, targetImmobile: true }),
      ),
    ).toBe(-4);
  });
});

describe('rangeModifier', () => {
  it('maps range brackets to their modifiers', () => {
    expect(rangeModifier('short')).toBe(0);
    expect(rangeModifier('medium')).toBe(2);
    expect(rangeModifier('long')).toBe(4);
    expect(rangeModifier('extreme')).toBe(6);
  });
});

describe('gatorBreakdown', () => {
  it('adds gunnery, movement, other and range into a total', () => {
    const breakdown = gatorBreakdown({
      gunnery: 3,
      heat: 0,
      pilotHits: 0,
      gator: gator({
        attackerMovement: 'ran',
        targetMovement: '7-9',
        range: 'medium',
        other: 2,
        useHeat: false,
        usePilotHits: false,
      }),
    });
    expect(breakdown).toEqual({
      gunnery: 3,
      attacker: 2,
      target: 3,
      other: 2,
      range: 2,
      heat: 0,
      pilotHits: 0,
      total: 12,
    });
  });

  it('folds heat and pilot hits into Other when enabled', () => {
    const breakdown = gatorBreakdown({
      gunnery: 4,
      heat: 13,
      pilotHits: 2,
      gator: gator({ other: 1 }),
    });
    expect(breakdown.heat).toBe(2);
    expect(breakdown.pilotHits).toBe(2);
    expect(breakdown.other).toBe(5);
    expect(breakdown.total).toBe(9);
  });

  it('ignores heat and pilot hits when their checkboxes are off', () => {
    const breakdown = gatorBreakdown({
      gunnery: 4,
      heat: 24,
      pilotHits: 3,
      gator: gator({ useHeat: false, usePilotHits: false }),
    });
    expect(breakdown.heat).toBe(0);
    expect(breakdown.pilotHits).toBe(0);
    expect(breakdown.other).toBe(0);
    expect(breakdown.total).toBe(4);
  });

  it('subtracts four for an immobile target', () => {
    const breakdown = gatorBreakdown({
      gunnery: 4,
      heat: 0,
      pilotHits: 0,
      gator: gator({ targetImmobile: true }),
    });
    expect(breakdown.target).toBe(-4);
    expect(breakdown.total).toBe(0);
  });
});

describe('pilotingDamageModifier', () => {
  it('adds one per 20 points of damage, capped at +4', () => {
    expect(pilotingDamageModifier(0)).toBe(0);
    expect(pilotingDamageModifier(19)).toBe(0);
    expect(pilotingDamageModifier(20)).toBe(1);
    expect(pilotingDamageModifier(39)).toBe(1);
    expect(pilotingDamageModifier(40)).toBe(2);
    expect(pilotingDamageModifier(79)).toBe(3);
    expect(pilotingDamageModifier(80)).toBe(4);
    expect(pilotingDamageModifier(120)).toBe(4);
  });

  it('never goes negative', () => {
    expect(pilotingDamageModifier(-10)).toBe(0);
  });
});

describe('pilotingBreakdown', () => {
  it('adds piloting skill, damage and manual other modifiers', () => {
    expect(
      pilotingBreakdown({ piloting: 4, gator: gator({ other: 1 }) }, 2),
    ).toEqual({ piloting: 4, damage: 2, other: 1, total: 7 });
  });

  it('includes the damage modifier by default', () => {
    const result = pilotingBreakdown({ piloting: 3, gator: gator() }, 1);
    expect(result.damage).toBe(1);
    expect(result.total).toBe(4);
  });

  it('drops the damage modifier when the toggle is off', () => {
    const result = pilotingBreakdown(
      { piloting: 3, gator: gator({ usePilotingDamage: false }) },
      3,
    );
    expect(result.damage).toBe(0);
    expect(result.total).toBe(3);
  });

  it('ignores other when rounding is involved', () => {
    const result = pilotingBreakdown(
      { piloting: 2, gator: gator({ other: 1.4 }) },
      0,
    );
    expect(result.other).toBe(1);
    expect(result.total).toBe(3);
  });
});

describe('twoDiceOdds', () => {
  it('reports exact 2d6 odds for each target number', () => {
    expect(twoDiceOdds(2)).toBe(100);
    expect(twoDiceOdds(4)).toBe(92);
    expect(twoDiceOdds(7)).toBe(58);
    expect(twoDiceOdds(8)).toBe(42);
    expect(twoDiceOdds(10)).toBe(17);
    expect(twoDiceOdds(12)).toBe(3);
  });

  it('clamps impossible and trivial target numbers', () => {
    expect(twoDiceOdds(1)).toBe(100);
    expect(twoDiceOdds(13)).toBe(0);
    expect(twoDiceOdds(20)).toBe(0);
  });
});

describe('signed', () => {
  it('prefixes positive modifiers and leaves zero or negative values alone', () => {
    expect(signed(2)).toBe('+2');
    expect(signed(0)).toBe('0');
    expect(signed(-4)).toBe('-4');
  });
});
