import { describe, expect, it } from 'vitest';
import { logoUrl } from './DocumentPdf.utils';

describe('logoUrl', () => {
  it('preserves an embedded data URL for synthetic and uploaded PDF assets', () => {
    const dataUrl = 'data:image/png;base64,AAAA';
    expect(logoUrl({ company_logo: dataUrl } as never)).toBe(dataUrl);
  });
});
