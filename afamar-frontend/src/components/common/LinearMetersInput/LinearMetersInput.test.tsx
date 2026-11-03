import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LinearMetersInput } from './LinearMetersInput';

describe('LinearMetersInput — decimales locales', () => {
  it.each([
    ['0,50', 0.5],
    ['0.15', 0.15],
    ['1,50', 1.5],
  ])('commits %s as %s', (raw, expected) => {
    const onCommit = vi.fn();
    render(<LinearMetersInput value={0} onCommit={onCommit} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: raw } });
    expect(onCommit).toHaveBeenLastCalledWith(expected);
  });
});
