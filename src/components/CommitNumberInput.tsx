import { useCallback, useEffect, useRef } from 'react';

interface CommitNumberInputProps {
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  title?: string;
  className?: string;
  /**
   * When true, the value is written to the store as soon as the native
   * up/down spinner is used (each step) instead of waiting for blur/Enter.
   * Typing still commits on blur/Enter so it never spams the undo stack.
   */
  immediate?: boolean;
}

/**
 * Number input that only writes to the store on blur or Enter. Typing,
 * clearing the field, or pressing Escape never spams the undo stack.
 *
 * The input is intentionally uncontrolled: a controlled `<input type="number">`
 * re-renders on every change, which fights the browser's native up/down
 * spinner and stops it working. Reading the value from a ref keeps the
 * spinner intact while `immediate` still commits each spinner step.
 */
export function CommitNumberInput({
  value,
  onCommit,
  min,
  max,
  label,
  title,
  className,
  immediate = false,
}: CommitNumberInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const latest = useRef({ value, onCommit, min, max });
  latest.current = { value, onCommit, min, max };

  const commit = useCallback(() => {
    const input = ref.current;
    if (!input) return;
    const { value: currentValue, onCommit: commitFn, min: currentMin, max: currentMax } =
      latest.current;
    const parsed = Number.parseInt(input.value, 10);
    if (!Number.isFinite(parsed)) {
      if (document.activeElement === input) input.value = String(currentValue);
      return;
    }
    let next = parsed;
    if (currentMin !== undefined) next = Math.max(currentMin, next);
    if (currentMax !== undefined) next = Math.min(currentMax, next);
    input.value = String(next);
    if (next !== currentValue) commitFn(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the field in sync with external store changes (e.g. the +/- stepper
  // buttons) without clobbering a value the user is currently editing.
  useEffect(() => {
    const input = ref.current;
    if (input && input.value !== String(value) && document.activeElement !== input) {
      input.value = String(value);
    }
  }, [value]);

  // The native `change` event fires on each spinner step and on blur/Enter for
  // typed input, so the spinner updates immediately when `immediate` is set
  // while typing never spams the undo stack.
  useEffect(() => {
    const input = ref.current;
    if (!input) return undefined;
    const handleChange = () => {
      if (immediate) commit();
    };
    input.addEventListener('change', handleChange);
    return () => input.removeEventListener('change', handleChange);
  }, [commit, immediate]);

  return (
    <input
      ref={ref}
      className={className}
      type="number"
      min={min}
      max={max}
      defaultValue={String(value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          if (ref.current) ref.current.value = String(value);
          event.currentTarget.blur();
        }
      }}
      aria-label={label}
      title={title}
    />
  );
}
