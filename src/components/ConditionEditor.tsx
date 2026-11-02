import { useState, type FormEvent } from 'react';
import { useStore } from '../state/store';

interface ConditionEditorProps {
  combatantId: string;
  presets: string[];
}

export function ConditionEditor({ combatantId, presets }: ConditionEditorProps) {
  const { addCondition } = useStore();
  const [label, setLabel] = useState('');
  const [rounds, setRounds] = useState('');
  const listId = `condition-options-${combatantId}`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!label.trim()) return;
    const parsed = rounds.trim() === '' ? null : Math.max(1, Number.parseInt(rounds, 10) || 0);
    addCondition(combatantId, label, parsed);
    setLabel('');
    setRounds('');
  };

  return (
    <form className="condition-form" onSubmit={submit}>
      <input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        list={listId}
        placeholder="Condition"
        aria-label="Condition name"
        autoComplete="off"
      />
      <datalist id={listId}>
        {presets.map((preset) => (
          <option key={preset} value={preset} />
        ))}
      </datalist>
      <input
        className="rounds-input"
        type="number"
        min={1}
        value={rounds}
        onChange={(event) => setRounds(event.target.value)}
        placeholder="Rounds"
        aria-label="Duration in rounds (blank means indefinite)"
        title="Duration in rounds. Leave blank for indefinite."
      />
      <button className="btn small" type="submit" disabled={!label.trim()}>
        Add
      </button>
    </form>
  );
}
