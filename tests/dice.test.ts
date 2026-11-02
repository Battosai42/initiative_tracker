import { describe, expect, it } from 'vitest';
import {
  describeResult,
  rollD20,
  rollExpression,
  rollInitiativeScore,
  type Rng,
} from '../src/lib/dice';

function queue(values: number[]): Rng {
  let index = 0;
  return () => values[index++ % values.length];
}

describe('dice expressions', () => {
  it('adds dice and modifiers', () => {
    const outcome = rollExpression('2d6+3', () => 4);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.total).toBe(11);
      expect(outcome.result.parts[0].values).toEqual([4, 4]);
    }
  });

  it('supports implicit dice counts and negative modifiers', () => {
    const outcome = rollExpression('d20-2', () => 10);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result.total).toBe(8);
  });

  it('supports several terms and spaces', () => {
    const outcome = rollExpression('1d6 + 1d8 - 1', (sides) => (sides === 6 ? 3 : 7));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result.total).toBe(9);
  });

  it('rejects malformed expressions', () => {
    expect(rollExpression('2d').ok).toBe(false);
    expect(rollExpression('banana').ok).toBe(false);
    expect(rollExpression('').ok).toBe(false);
    expect(rollExpression('d0').ok).toBe(false);
  });

  it('describes results for the log', () => {
    const outcome = rollExpression('2d6+3', () => 4);
    if (outcome.ok) {
      expect(describeResult(outcome.result)).toContain('2d6 (4, 4)');
      expect(describeResult(outcome.result)).toContain('+ 3');
    }
  });
});

describe('d20 advantage', () => {
  it('keeps the higher roll for advantage', () => {
    const result = rollD20('advantage', queue([3, 5]));
    expect(result.total).toBe(5);
  });

  it('keeps the lower roll for disadvantage', () => {
    const result = rollD20('disadvantage', queue([3, 5]));
    expect(result.total).toBe(3);
  });

  it('uses one roll for a normal d20', () => {
    const result = rollD20('normal', queue([3, 5]));
    expect(result.total).toBe(3);
  });
});

describe('initiative formulas', () => {
  it('adds the modifier to a d20', () => {
    expect(rollInitiativeScore('d20', 7, () => 10).total).toBe(17);
  });

  it('uses 1d6 plus the base for Shadowrun', () => {
    expect(rollInitiativeScore('shadowrun', 12, () => 4).total).toBe(16);
  });

  it('uses 2d6 for side initiative', () => {
    expect(rollInitiativeScore('side', 0, queue([3, 6])).total).toBe(9);
  });
});
