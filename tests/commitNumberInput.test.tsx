// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { CommitNumberInput } from '../src/components/CommitNumberInput';

describe('CommitNumberInput', () => {
  it('commits on each spinner step when immediate is set', () => {
    const onCommit = vi.fn();
    const { container } = render(
      <CommitNumberInput value={5} onCommit={onCommit} min={0} max={12} immediate />,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    // Simulate the native up/down spinner firing a `change` with a new value.
    fireEvent.change(input, { target: { value: '6' } });
    expect(onCommit).toHaveBeenCalledWith(6);
  });

  it('waits for blur when immediate is not set', () => {
    const onCommit = vi.fn();
    const { container } = render(
      <CommitNumberInput value={5} onCommit={onCommit} min={0} max={12} />,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '6' } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(6);
  });

  it('clamps to the min/max bounds', () => {
    const onCommit = vi.fn();
    const { container } = render(
      <CommitNumberInput value={5} onCommit={onCommit} min={0} max={12} immediate />,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '99' } });
    expect(onCommit).toHaveBeenCalledWith(12);
  });
});
