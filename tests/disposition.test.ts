import { describe, expect, it } from 'vitest';
import { createCombatant, normalizeCombatant } from '../src/lib/factory';

describe('combatant disposition', () => {
  it('marks monsters unfriendly by default', () => {
    expect(createCombatant({ role: 'monster' }).disposition).toBe('unfriendly');
  });

  it('marks PCs friendly and NPCs neutral by default', () => {
    expect(createCombatant({ role: 'pc' }).disposition).toBe('friendly');
    expect(createCombatant({ role: 'npc' }).disposition).toBe('neutral');
    expect(createCombatant().disposition).toBe('neutral');
  });

  it('keeps an explicit disposition regardless of role', () => {
    expect(createCombatant({ role: 'monster', disposition: 'friendly' }).disposition).toBe(
      'friendly',
    );
    expect(createCombatant({ role: 'pc', disposition: 'unfriendly' }).disposition).toBe(
      'unfriendly',
    );
    expect(createCombatant({ role: 'npc', disposition: 'neutral' }).disposition).toBe('neutral');
  });
});

describe('normalizing older saved data', () => {
  it('derives a missing disposition from the role', () => {
    expect(normalizeCombatant({ name: 'Goblin', role: 'monster' }).disposition).toBe(
      'unfriendly',
    );
    expect(normalizeCombatant({ name: 'Aria', role: 'pc' }).disposition).toBe('friendly');
    expect(normalizeCombatant({ name: 'Innkeeper', role: 'npc' }).disposition).toBe('neutral');
  });

  it('preserves a valid stored disposition', () => {
    expect(
      normalizeCombatant({ name: 'Goblin', role: 'monster', disposition: 'friendly' })
        .disposition,
    ).toBe('friendly');
    expect(
      normalizeCombatant({ name: 'Aria', role: 'pc', disposition: 'unfriendly' })
        .disposition,
    ).toBe('unfriendly');
    expect(
      normalizeCombatant({ name: 'Innkeeper', role: 'npc', disposition: 'neutral' })
        .disposition,
    ).toBe('neutral');
  });

  it('falls back to the role when the stored disposition is invalid', () => {
    expect(
      normalizeCombatant({ name: 'Goblin', role: 'monster', disposition: 'hostile' })
        .disposition,
    ).toBe('unfriendly');
    expect(
      normalizeCombatant({ name: 'Aria', role: 'pc', disposition: 42 }).disposition,
    ).toBe('friendly');
    expect(
      normalizeCombatant({ name: 'Innkeeper', role: 'npc', disposition: 'unknown' })
        .disposition,
    ).toBe('neutral');
  });
});
