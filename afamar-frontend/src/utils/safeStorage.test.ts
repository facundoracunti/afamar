import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from './safeStorage';

describe('safeStorage', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('reads, writes and removes values normally', () => {
    writeLocalStorage('safe-test', 'value');
    expect(readLocalStorage('safe-test')).toBe('value');
    removeLocalStorage('safe-test');
    expect(readLocalStorage('safe-test')).toBeNull();
  });

  it('does not throw when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage denied');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage denied');
    });

    expect(readLocalStorage('blocked')).toBeNull();
    expect(() => writeLocalStorage('blocked', 'value')).not.toThrow();
    expect(() => removeLocalStorage('blocked')).not.toThrow();
  });
});
