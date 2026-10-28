import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import http from '@/api/http';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('@/api/http', () => ({
  default: { post: vi.fn() },
}));

function AuthProbe() {
  const { isAuthenticated, user, login } = useAuth();
  return (
    <div>
      <span data-testid="auth-state">{isAuthenticated ? user?.username : 'logged-out'}</span>
      <button type="button" onClick={() => void login({ username: 'admin', password: 'secret' })}>
        Login
      </button>
    </div>
  );
}

const user = { id: 1, username: 'admin', full_name: 'Administrador', is_admin: true };

describe('AuthProvider storage resilience', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('recovers a valid session from localStorage', async () => {
    window.localStorage.setItem('auth_token', 'token');
    window.localStorage.setItem('auth_user', JSON.stringify(user));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('auth-state').textContent).toBe('admin'));
  });

  it('logs in and persists the returned session', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { access_token: 'token', user } } as never);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(screen.getByTestId('auth-state').textContent).toBe('admin'));
    expect(window.localStorage.getItem('auth_token')).toBe('token');
    expect(JSON.parse(window.localStorage.getItem('auth_user') || '{}')).toEqual(user);
  });
});
