/** Best-effort localStorage access for private modes and restricted WebViews. */
export function readLocalStorage(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  } catch {
    // Storage is optional; the current session can still operate in memory.
  }
}

export function removeLocalStorage(key: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  } catch {
    // Ignore blocked or unavailable storage during logout/cleanup.
  }
}
