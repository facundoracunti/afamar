import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function BrokenChild(): JSX.Element {
  throw new Error('internal diagnostic detail');
}

describe('ErrorBoundary', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows a safe recovery message instead of a blank screen', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar AFAMAR');
    expect(screen.getByRole('button', { name: 'Recargar aplicación' })).toBeTruthy();
    expect(screen.queryByText('internal diagnostic detail')).toBeNull();
  });
});
