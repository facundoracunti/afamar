import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders the status label', () => {
    render(<StatusBadge status="APPROVED" />);
    expect(screen.getByText('Aprobado')).toBeDefined();
  });

  it('applies custom style', () => {
    const { container } = render(<StatusBadge status="PENDING" style={{ marginTop: 4 }} />);
    expect(container.firstChild).toBeDefined();
  });
});
