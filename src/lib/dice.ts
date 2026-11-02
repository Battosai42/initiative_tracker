export type Rng = (sides: number) => number;
export type AdvantageMode = 'normal' | 'advantage' | 'disadvantage';

export interface DicePart {
  label: string;
  values: number[];
  total: number;
}

export interface DiceResult {
  expression: string;
  total: number;
  parts: DicePart[];
  note?: string;
}

const buffer = new Uint32Array(1);

/** Cryptographically seeded die roll, with rejection sampling to avoid bias. */
export const secureRng: Rng = (sides: number) => {
  const max = Math.floor(0xffffffff / sides) * sides;
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= max);
  return (value % sides) + 1;
};

export function rollDie(sides: number, rng: Rng = secureRng): number {
  if (!Number.isFinite(sides) || sides < 1) {
    throw new Error('A die needs at least one side.');
  }
  return rng(Math.floor(sides));
}

export function rollExpression(
  expression: string,
  rng: Rng = secureRng,
): { ok: true; result: DiceResult } | { ok: false; error: string } {
  const cleaned = expression.replace(/\s+/g, '').toLowerCase();
  if (!cleaned) return { ok: false, error: 'Enter a dice expression, e.g. 2d6+3.' };

  const term = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g;
  const parts: DicePart[] = [];
  let total = 0;
  let index = 0;
  let match: RegExpExecArray | null;

  while ((match = term.exec(cleaned)) !== null) {
    if (match.index !== index) {
      return { ok: false, error: `Unexpected "${cleaned.slice(index, match.index)}" in expression.` };
    }
    index = term.lastIndex;

    if (match[3] !== undefined) {
      const sign = match[1] === '-' ? -1 : 1;
      const count = match[2] === '' ? 1 : Number(match[2]);
      const sides = Number(match[3]);
      if (count < 1 || count > 100) {
        return { ok: false, error: 'Dice count must be between 1 and 100.' };
      }
      if (sides < 1 || sides > 1000) {
        return { ok: false, error: 'Dice sides must be between 1 and 1000.' };
      }
      const values = Array.from({ length: count }, () => rollDie(sides, rng));
      const sum = values.reduce((a, b) => a + b, 0) * sign;
      total += sum;
      parts.push({
        label: `${sign < 0 ? '-' : ''}${count}d${sides}`,
        values: sign < 0 ? values.map((v) => -v) : values,
        total: sum,
      });
    } else {
      const sign = match[4] === '-' ? -1 : 1;
      const value = Number(match[5]) * sign;
      total += value;
      parts.push({ label: String(value), values: [], total: value });
    }
  }

  if (index !== cleaned.length) {
    return { ok: false, error: `Could not parse "${cleaned.slice(index)}".` };
  }
  if (parts.length === 0) {
    return { ok: false, error: 'No dice or numbers found.' };
  }

  return { ok: true, result: { expression: cleaned, total, parts } };
}

export function rollD20(mode: AdvantageMode = 'normal', rng: Rng = secureRng): DiceResult {
  const first = rollDie(20, rng);
  if (mode === 'normal') {
    return {
      expression: 'd20',
      total: first,
      parts: [{ label: 'd20', values: [first], total: first }],
    };
  }
  const second = rollDie(20, rng);
  const kept = mode === 'advantage' ? Math.max(first, second) : Math.min(first, second);
  return {
    expression: `d20 (${mode})`,
    total: kept,
    parts: [{ label: 'd20', values: [first, second], total: kept }],
    note: `kept ${kept}`,
  };
}

export function rollInitiativeScore(
  system: 'd20' | 'shadowrun' | 'side' | 'manual',
  modifier: number,
  rng: Rng = secureRng,
): DiceResult {
  if (system === 'shadowrun') {
    const die = rollDie(6, rng);
    return {
      expression: `1d6 + ${modifier}`,
      total: die + modifier,
      parts: [
        { label: '1d6', values: [die], total: die },
        { label: 'base', values: [], total: modifier },
      ],
    };
  }
  if (system === 'side') {
    const a = rollDie(6, rng);
    const b = rollDie(6, rng);
    return {
      expression: '2d6',
      total: a + b,
      parts: [{ label: '2d6', values: [a, b], total: a + b }],
    };
  }
  const die = rollDie(20, rng);
  return {
    expression: `1d20 ${modifier >= 0 ? '+' : '-'} ${Math.abs(modifier)}`,
    total: die + modifier,
    parts: [
      { label: '1d20', values: [die], total: die },
      { label: 'mod', values: [], total: modifier },
    ],
  };
}

export function describeResult(result: DiceResult): string {
  return result.parts
    .map((part) => {
      if (part.values.length === 0) return part.label;
      return `${part.label} (${part.values.join(', ')})`;
    })
    .join(' + ')
    .replace(/\+ -/g, '- ');
}
