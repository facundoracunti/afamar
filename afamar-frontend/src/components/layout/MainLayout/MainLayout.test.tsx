import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import MainLayout from './MainLayout';
import { Sidebar } from './Sidebar';

function installMatchMedia(value: MediaQueryList) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => value),
  });
}

describe('MainLayout media query compatibility', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('uses the legacy listener API and removes it on unmount', () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    const media = {
      matches: true,
      addListener,
      removeListener,
    } as unknown as MediaQueryList;
    installMatchMedia(media);

    const view = render(
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter>
            <MainLayout />
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>,
    );

    expect(addListener).toHaveBeenCalledOnce();
    view.unmount();
    expect(removeListener).toHaveBeenCalledWith(addListener.mock.calls[0][0]);
  });

  it('uses modern listeners and removes them on unmount', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const media = {
      matches: false,
      addEventListener,
      removeEventListener,
    } as unknown as MediaQueryList;
    installMatchMedia(media);

    const view = render(
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter>
            <MainLayout />
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>,
    );

    expect(addEventListener).toHaveBeenCalledWith('change', addEventListener.mock.calls[0][1]);
    view.unmount();
    expect(removeEventListener).toHaveBeenCalledWith('change', addEventListener.mock.calls[0][1]);
  });
});

describe('Sidebar responsive collapse state', () => {
  it('keeps the drawer content expanded on mobile even when desktop collapse is persisted', () => {
    render(
      <MemoryRouter initialEntries={['/admin/budgets']}>
        <Sidebar
          isCollapsed
          onCollapse={vi.fn()}
          expanded="budgets"
          onExpand={vi.fn()}
          isMobile
          isMobileOpen
          onMobileClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('INICIO')).toBeTruthy();
    expect(screen.getByText('Presupuestos')).toBeTruthy();
    expect(screen.getByText('Nuevo Presupuesto')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Presupuestos' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps desktop collapsed mode icon-only', () => {
    render(
      <MemoryRouter>
        <Sidebar
          isCollapsed
          onCollapse={vi.fn()}
          expanded=""
          onExpand={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText('INICIO')).toBeNull();
    expect(screen.queryByText('Presupuestos')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toBeTruthy();
  });
});
