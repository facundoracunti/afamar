/**
 * Tests for `PaywayLinkCard`. Covers the URL display, the WhatsApp
 * shortcut URL builder and the visual structure (label, input, buttons).
 *
 * The component delegates URL building to `utils/whatsapp` which
 * defaults to desktop (`web.whatsapp.com/send`) in jsdom. Mobile URLs
 * (`wa.me`) are tested separately via the exported `buildWhatsappUrl`
 * wrapper with `forceMobile=true`.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaywayLinkCard } from './PaywayLinkCard';
import { buildWhatsAppUrl } from '../../../utils/whatsapp';

describe('PaywayLinkCard', () => {
  it('renders the checkout URL as a readonly text input', () => {
    const PAYWAY_URL = 'https://payway.example.com/link/A-000090-7f3a1b2c';
    render(<PaywayLinkCard url={PAYWAY_URL} />);
    const input = screen.getByLabelText('URL del link de pago') as HTMLInputElement;
    expect(input.value).toBe(PAYWAY_URL);
    expect(input.readOnly).toBe(true);
  });

  it('renders a "Copiar" button so the operator can copy the URL', () => {
    const PAYWAY_URL = 'https://payway.example.com/link/A-000090-7f3a1b2c';
    render(<PaywayLinkCard url={PAYWAY_URL} />);
    expect(screen.getByLabelText('Copiar link de pago')).toBeDefined();
  });

  it('renders a WhatsApp shortcut that opens WhatsApp Web with the URL pre-filled', () => {
    const PAYWAY_URL = 'https://payway.example.com/link/A-000090-7f3a1b2c';
    render(
      <PaywayLinkCard
        url={PAYWAY_URL}
        whatsappPhone="+54 11 1234-5678"
        whatsappTemplate="Hola! Pago OT: {{url}}"
      />,
    );
    const wa = screen.getByLabelText('Enviar link por WhatsApp') as HTMLAnchorElement;
    expect(wa.target).toBe('_blank');
    const parsed = new URL(wa.href);
    expect(parsed.origin + parsed.pathname).toBe('https://web.whatsapp.com/send');
    expect(parsed.searchParams.get('phone')).toBe('541112345678');
    expect(parsed.searchParams.get('text')).toContain(PAYWAY_URL);
    expect(parsed.searchParams.get('text')).toContain('Hola');
  });

  it('strips non-digits from the phone number (whatsapp requires digits only)', () => {
    const PAYWAY_URL = 'https://payway.example.com/link/A-000090-7f3a1b2c';
    render(
      <PaywayLinkCard
        url={PAYWAY_URL}
        whatsappPhone="+1 (555) 123-4567 ext 89"
      />,
    );
    const wa = screen.getByLabelText('Enviar link por WhatsApp') as HTMLAnchorElement;
    const parsed = new URL(wa.href);
    expect(parsed.searchParams.get('phone')).toBe('1555123456789');
  });

  it('falls back to https://web.whatsapp.com/send (no phone param) when phone is missing', () => {
    const PAYWAY_URL = 'https://payway.example.com/link/A-000090-7f3a1b2c';
    render(<PaywayLinkCard url={PAYWAY_URL} />);
    const wa = screen.getByLabelText('Enviar link por WhatsApp') as HTMLAnchorElement;
    const parsed = new URL(wa.href);
    expect(parsed.origin + parsed.pathname).toBe('https://web.whatsapp.com/send');
    expect(parsed.searchParams.has('phone')).toBe(false);
    expect(parsed.searchParams.has('text')).toBe(true);
  });

  it('renders a custom label when provided', () => {
    const PAYWAY_URL = 'https://payway.example.com/link/A-000090-7f3a1b2c';
    render(<PaywayLinkCard url={PAYWAY_URL} label="Último cobro Payway" />);
    expect(screen.getByText(/Último cobro Payway/i)).toBeDefined();
  });

  it('generates a mobile wa.me URL when forceMobile is true', () => {
    const url = buildWhatsAppUrl('+54 11 1234-5678', 'Pago!', true);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://wa.me/541112345678');
    expect(parsed.searchParams.get('text')).toBe('Pago!');
  });
});
