import { useEffect, useState } from 'react';

interface CommitNumberInputProps {
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  title?: string;
  className?: string;
}

/**
 * Number input that only writes to the store on blur or Enter.
 * Typing, clearing the field, or pressing Escape never spams the undo stack.
 */
export function CommitNumberInput({
  value,
  onCommit,
  min,
  max,
  label,
  title,
  className,
}: CommitNumberInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    let next = parsed;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <input
      className={className}
      type="number"
      min={min}
      max={max}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraft(String(value));
          event.currentTarget.blur();
        }
      }}
      aria-label={label}
      title={title}
    />
  );
}
