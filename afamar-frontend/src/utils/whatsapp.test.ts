/**
 * Tests for the shared WhatsApp share-link builders in `utils/whatsapp.ts`.
 *
 * Covers the platform-aware URL format (desktop `web.whatsapp.com/send`,
 * mobile `wa.me`), the phone number stripping, the exact Payway payment
 * block, and the absolute clickable PDF link in the document summary.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_PUBLIC_URL,
  buildWhatsAppUrl,
  buildDocumentShareMessage,
  buildOrderShareMessage,
  buildPublicPdfUrl,
  getPublicAppBaseUrl,
  isLoopbackOrigin,
  resolvePublicDocumentPdfUrl,
  toAbsoluteUrl,
} from './whatsapp';

const PAYWAY = 'https://payway.example.com/link/A-000090-abc';

describe('isLoopbackOrigin', () => {
  it('flags loopback hosts, including IPv4/IPv6 shorthand and subdomains', () => {
    for (const origin of [
      'http://localhost:3090',
      'https://localhost',
      'http://127.0.0.1:8000',
      'http://127.1.2.3',
      'http://0.0.0.0',
      'http://[::1]:3090',
      'http://foo.localhost',
    ]) {
      expect(isLoopbackOrigin(origin)).toBe(true);
    }
  });

  it('accepts public origins', () => {
    for (const origin of [
      'https://afamar.com.ar',
      'https://87k533kf-3090.brs.devtunnels.ms',
      'http://192.168.1.20:3090', // LAN origin: operator responsibility, not loopback
    ]) {
      expect(isLoopbackOrigin(origin)).toBe(false);
    }
  });
});

describe('toAbsoluteUrl', () => {
  it('prepends the base to a relative API path', () => {
    const url = toAbsoluteUrl('/api/v1/work-orders/92/pdf', 'https://mi.afamar.com');
    expect(url).toBe('https://mi.afamar.com/api/v1/work-orders/92/pdf');
    // WhatsApp needs an absolute http(s) URL to render the link as clickable.
    expect(url).toMatch(/^https?:\/\//);
  });

  it('keeps already-absolute URLs untouched', () => {
    const absolute = 'https://afamar.com/orden.pdf';
    expect(toAbsoluteUrl(absolute, 'https://mi.afamar.com')).toBe(absolute);
  });

  it('keeps empty inputs empty', () => {
    expect(toAbsoluteUrl('', 'https://mi.afamar.com')).toBe('');
  });
});

describe('buildWhatsAppUrl', () => {
  it('builds a desktop web.whatsapp.com/send URL by default', () => {
    const url = buildWhatsAppUrl('+54 11 1234-5678', 'Hola!');
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://web.whatsapp.com/send');
    expect(parsed.searchParams.get('phone')).toBe('541112345678');
    expect(parsed.searchParams.get('text')).toBe('Hola!');
  });

  it('builds a mobile wa.me URL when forceMobile is true', () => {
    const url = buildWhatsAppUrl('+54 11 1234-5678', 'Hola!', true);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://wa.me/541112345678');
    expect(parsed.searchParams.get('text')).toBe('Hola!');
  });

  it('strips non-digit characters from the phone number', () => {
    const url = buildWhatsAppUrl('+1 (555) 123-4567 ext 89', 'x');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('phone')).toBe('1555123456789');
  });

  it('omits the phone param entirely when the number is missing', () => {
    for (const forceMobile of [undefined, false, true]) {
      const url = buildWhatsAppUrl(null, 'x', forceMobile);
      const parsed = new URL(url);
      expect(parsed.searchParams.has('phone')).toBe(false);
      expect(parsed.searchParams.get('text')).toBe('x');
    }
  });

  it('URL-encodes the message', () => {
    const url = buildWhatsAppUrl('11', 'Hola Fernández, todo bien?');
    const parsed = new URL(url);
    expect(decodeURIComponent(parsed.searchParams.get('text') ?? '')).toBe(
      'Hola Fernández, todo bien?',
    );
    // The raw URL form-encodes: spaces as '+', accents/em-dashes percent-encoded.
    expect(url).toContain('Fern%C3%A1ndez');
    expect(url).toContain('Hola+Fern%C3%A1ndez');
  });
});

describe('buildPublicPdfUrl', () => {
  it('builds the no-auth work-orders PDF URL with the encoded token', () => {
    const url = buildPublicPdfUrl('work_order', 'abc.def', 'https://mi.afamar.com');
    expect(url).toBe('https://mi.afamar.com/api/v1/public/work-orders/pdf?token=abc.def');
  });

  it('builds the no-auth budgets PDF URL', () => {
    const url = buildPublicPdfUrl('budget', 'tok-123', 'https://mi.afamar.com');
    expect(url).toBe('https://mi.afamar.com/api/v1/public/budgets/pdf?token=tok-123');
  });

  it('URL-encodes the token (watch out for base64url edge chars)', () => {
    const url = buildPublicPdfUrl('work_order', 'a+b/c==', 'https://mi.afamar.com');
    expect(url).toContain('token=a%2Bb%2Fc%3D%3D');
    // The public link must be a full absolute URL (clickable in WhatsApp).
    expect(url).toMatch(/^https?:\/\//);
  });

  it('defaults to window.location.origin when no base is given', () => {
    (globalThis as Record<string, unknown>).window = {
      ...(globalThis.window ?? {}),
      location: { origin: 'https://afamar-prod.com' },
    };
    const url = buildPublicPdfUrl('budget', 'x');
    expect(url).toBe('https://afamar-prod.com/api/v1/public/budgets/pdf?token=x');
  });

  it('strips a trailing slash from the base so the segment never double-separates', () => {
    const url = buildPublicPdfUrl('work_order', 'tok', 'https://afamar.app/');
    expect(url).toBe('https://afamar.app/api/v1/public/work-orders/pdf?token=tok');
  });
});

describe('public URL base resolution', () => {
  beforeEach(() => {
    // Nothing is configured by default: resolution falls back to the origin.
    (window as unknown as Record<string, unknown>).APP_CONFIG = undefined;
    (import.meta.env as Record<string, unknown>).VITE_PUBLIC_URL = '';
    (import.meta.env as Record<string, unknown>).VITE_API_BASE_URL = '';
    // Restore jsdom's loopback origin if a previous test replaced it.
    (globalThis as Record<string, unknown>).window = {
      ...(globalThis.window ?? {}),
      location: { origin: 'http://localhost:3000' },
    };
  });

  afterEach(() => {
    (window as unknown as Record<string, unknown>).APP_CONFIG = undefined;
    (import.meta.env as Record<string, unknown>).VITE_PUBLIC_URL = '';
    (import.meta.env as Record<string, unknown>).VITE_API_BASE_URL = '';
    (globalThis as Record<string, unknown>).window = {
      ...(globalThis.window ?? {}),
      location: { origin: 'http://localhost:3000' },
    };
  });

  it('uses APP_CONFIG.PUBLIC_URL when configured, never the localhost origin', () => {
    // jsdom's origin is http://localhost:PORT — if PUBLIC_URL were ignored,
    // the share link would be localhost and useless for the client.
    (window as unknown as Record<string, unknown>).APP_CONFIG = {
      API_URL: '/api/v1',
      PUBLIC_URL: 'https://87k533kf-3090.brs.devtunnels.ms',
    };
    const url = buildPublicPdfUrl('work_order', 'abc.def');
    expect(url).toMatch(/^https:\/\//);
    expect(url).toBe(
      'https://87k533kf-3090.brs.devtunnels.ms/api/v1/public/work-orders/pdf?token=abc.def',
    );
    expect(url).not.toMatch(/localhost|:3090|:3000/);
  });

  it('uses the build-time VITE_PUBLIC_URL as the next fallback', () => {
    (import.meta.env as Record<string, unknown>).VITE_PUBLIC_URL = 'https://afamar.com.ar';
    const url = buildPublicPdfUrl('budget', 'zn');
    expect(url).toMatch(/^https:\/\//);
    expect(url).toBe('https://afamar.com.ar/api/v1/public/budgets/pdf?token=zn');
    expect(url).not.toMatch(/localhost|:3090|:3000/);
  });

  it('derives the origin from an absolute VITE_API_BASE_URL (devtunnel API base)', () => {
    // In a devtunnel setup the API base is often the only public URL:
    // its origin must be picked up for the share link.
    (import.meta.env as Record<string, unknown>).VITE_API_BASE_URL =
      'https://87k533kf-3090.brs.devtunnels.ms/api/v1';
    const url = buildPublicPdfUrl('work_order', 'abc.def');
    expect(url).toBe(
      'https://87k533kf-3090.brs.devtunnels.ms/api/v1/public/work-orders/pdf?token=abc.def',
    );
    expect(url).not.toMatch(/localhost|:3000|:3090/);
  });

  it('skips a relative VITE_API_BASE_URL (same-origin / vite proxy)', () => {
    (import.meta.env as Record<string, unknown>).VITE_API_BASE_URL = '/api/v1';
    (window as unknown as Record<string, unknown>).APP_CONFIG = {
      API_URL: '/api/v1',
      PUBLIC_URL: 'https://afamar.com.ar',
    };
    const url = buildPublicPdfUrl('budget', 'nt');
    expect(url).toBe('https://afamar.com.ar/api/v1/public/budgets/pdf?token=nt');
  });

  it('never leaks a loopback origin — falls back to the default tunnel URL', () => {
    // jsdom's origin is http://localhost:PORT. With no public URL configured
    // the DEFAULT_PUBLIC_URL (active devtunnel) is used so the PDF link is
    // still emitted — never a localhost one that breaks on the phone.
    const base = getPublicAppBaseUrl();
    expect(base).toBe(DEFAULT_PUBLIC_URL);
    expect(base).toMatch(/^https:\/\//);
    expect(base).not.toMatch(/localhost|:3000|:3090|127\./);
  });

  it('ALWAYS emits the PDF link when a document exists (no config, loopback origin)', () => {
    const url = buildPublicPdfUrl('work_order', 'abc.def');
    expect(url).toBe(
      `${DEFAULT_PUBLIC_URL}/api/v1/public/work-orders/pdf?token=abc.def`,
    );
    expect(url).toMatch(/^https:\/\//);
    expect(url).not.toMatch(/localhost|:3000|:3090/);
    const msg = buildDocumentShareMessage({
      documentLabel: 'la Orden de Trabajo',
      pdfUrl: url,
      pdfLabel: 'PDF de la Orden',
    });
    expect(msg).toContain('📄 Ver / Descargar PDF de la Orden:');
    expect(msg).toContain(
      `${DEFAULT_PUBLIC_URL}/api/v1/public/work-orders/pdf?token=abc.def`,
    );
  });

  it('keeps an explicit base override on top of both configured sources', () => {
    (window as unknown as Record<string, unknown>).APP_CONFIG = {
      API_URL: '/api/v1',
      PUBLIC_URL: 'https://runtime.example',
    };
    (import.meta.env as Record<string, unknown>).VITE_PUBLIC_URL = 'https://build.example';
    const url = buildPublicPdfUrl('work_order', 'tk', 'https://expl.myafamar.app');
    expect(url).toBe('https://expl.myafamar.app/api/v1/public/work-orders/pdf?token=tk');
  });

  it('absolutizes a relative API path via the same public base (toAbsoluteUrl)', () => {
    (window as unknown as Record<string, unknown>).APP_CONFIG = {
      API_URL: '/api/v1',
      PUBLIC_URL: 'https://pdf.afamar.com',
    };
    const url = toAbsoluteUrl('/api/v1/public/budgets/pdf?token=q');
    expect(url).toBe('https://pdf.afamar.com/api/v1/public/budgets/pdf?token=q');
    expect(url).toMatch(/^https:\/\//);
  });
});

describe('resolvePublicDocumentPdfUrl', () => {
  it('resolves the signed token via the provided fetcher and builds the URL', async () => {
    const fetchToken = async () => ({ data: { token: 'abc.def' } });
    const url = await resolvePublicDocumentPdfUrl('work_order', fetchToken, 'https://mi.afamar.com');
    expect(url).toBe('https://mi.afamar.com/api/v1/public/work-orders/pdf?token=abc.def');
  });

  it('returns empty string when the token fetch fails (offline / missing doc)', async () => {
    const failing = async (): Promise<{ data: { token?: string } }> => {
      throw new Error('network');
    };
    const url = await resolvePublicDocumentPdfUrl('work_order', failing);
    expect(url).toBe('');
    // A message built with the empty URL still sends (no PDF link block).
    const msg = buildDocumentShareMessage({ documentLabel: 'la Orden de Trabajo', pdfUrl: url });
    expect(msg).not.toContain('📄 Ver / Descargar');
  });

  it('returns empty string when the token is missing from the payload', async () => {
    const noToken = async () => ({ data: {} });
    const url = await resolvePublicDocumentPdfUrl('budget', noToken);
    expect(url).toBe('');
  });
});

describe('buildDocumentShareMessage', () => {
  it('builds the standard greeting with client name and document label', () => {
    const msg = buildDocumentShareMessage({
      clientName: 'Juan',
      documentLabel: 'la Orden de Trabajo',
      pdfUrl: 'https://afamar.com/orden.pdf',
    });
    expect(msg).toContain('Hola Juan!');
    expect(msg).toContain('Te enviamos la Orden de Trabajo formal de AFAMAR');
    expect(msg).toContain('https://afamar.com/orden.pdf');
    expect(msg).not.toContain('Payway');
  });

  it('does not require a client name', () => {
    const msg = buildDocumentShareMessage({
      documentLabel: 'el presupuesto',
      pdfUrl: '',
    });
    expect(msg).not.toContain('Hola');
  });

  it('includes the document number and detail lines when provided', () => {
    const msg = buildDocumentShareMessage({
      clientName: 'María',
      documentLabel: 'la Orden de Trabajo',
      documentNumber: 'A-000090',
      pdfUrl: '',
      detailLines: ['NEGRO BRASIL ×1 (2.1×0.6 m)', 'GRIS MARA ×2 (1.5×0.5 m)'],
      moneyLines: [
        { label: 'Total', value: '$ 1.234.567,00' },
        { label: 'Seña recibida', value: '$ 400.000,00' },
        { label: 'Saldo pendiente', value: '$ 834.567,00' },
      ],
    });
    expect(msg).toContain('N° A-000090');
    expect(msg).toContain('📋 Detalle:');
    expect(msg).toContain('• NEGRO BRASIL ×1 (2.1×0.6 m)');
    expect(msg).toContain('• GRIS MARA ×2 (1.5×0.5 m)');
    expect(msg).toContain('Total: $ 1.234.567,00');
    expect(msg).toContain('Seña recibida: $ 400.000,00');
    expect(msg).toContain('Saldo pendiente: $ 834.567,00');
  });

  it('composes the FULL message in order: saludo/N°, detalle+montos, PDF, Payway', () => {
    const publicPdfUrl = buildPublicPdfUrl('work_order', 'abc.def', 'https://mi.afamar.com');
    const msg = buildDocumentShareMessage({
      clientName: 'Juan',
      documentLabel: 'la Orden de Trabajo',
      documentNumber: 'A-000090',
      pdfUrl: publicPdfUrl,
      pdfLabel: 'PDF de la Orden',
      paywayLink: 'https://payway.example/checkout/xyz',
      detailLines: ['NEGRO BRASIL ×1 (2.1×0.6 m)'],
      moneyLines: [{ label: 'Total', value: '$ 1.234.567,00' }],
    });

    // 1. Saludo + número de Orden / Presupuesto.
    expect(msg).toContain('Hola Juan!');
    expect(msg).toContain('N° A-000090');
    // 2. Detalle de ítems y montos.
    expect(msg).toContain('📋 Detalle:');
    expect(msg).toContain('• NEGRO BRASIL ×1 (2.1×0.6 m)');
    expect(msg).toContain('Total: $ 1.234.567,00');
    // 3. Bloque PDF — SIEMPRE presente cuando existe el documento.
    expect(msg).toContain('📄 Ver / Descargar PDF de la Orden:');
    expect(msg).toContain(
      'https://mi.afamar.com/api/v1/public/work-orders/pdf?token=abc.def',
    );
    // 4. Bloque de pago Payway (al final).
    expect(msg).toContain('💳 Link de pago seguro (Payway):');
    expect(msg).toContain('https://payway.example/checkout/xyz');

    // Orden de los bloques dentro del mensaje.
    const numberIdx = msg.indexOf('N° A-000090');
    const detailIdx = msg.indexOf('📋 Detalle:');
    const totalIdx = msg.indexOf('Total:');
    const pdfIdx = msg.indexOf('📄 Ver / Descargar');
    const paywayIdx = msg.indexOf('💳');
    expect(detailIdx).toBeGreaterThan(numberIdx);
    expect(totalIdx).toBeGreaterThan(detailIdx);
    expect(pdfIdx).toBeGreaterThan(totalIdx);
    expect(paywayIdx).toBeGreaterThan(pdfIdx);
  });

  it('renders the PDF as an absolute clickable link block', () => {
    // Relative paths are absolutized against the app origin. A loopback
    // origin (jsdom default) is never used for share links → point the
    // origin at a real deployment.
    (globalThis as Record<string, unknown>).window = {
      ...(globalThis.window ?? {}),
      location: { origin: 'https://afamar-prod.com' },
    };
    const msg = buildDocumentShareMessage({
      documentLabel: 'la Orden de Trabajo',
      pdfUrl: '/api/v1/work-orders/92/pdf',
      pdfLabel: 'PDF de la Orden',
    });
    // The old wording ("Podés revisarlo e imprimirlo desde el siguiente
    // link: /api/v1/...") rendered a bare relative path that WhatsApp does
    // NOT hyperlink. It must now be an absolute blob-style block label.
    expect(msg).toContain('📄 Ver / Descargar PDF de la Orden:');
    expect(msg).not.toContain('Podés revisarlo e imprimirlo desde el siguiente link:');
    const pdfLine = msg.split('\n').find((l) => l.includes('/api/v1/work-orders/92/pdf'));
    expect(pdfLine).toBeDefined();
    expect(pdfLine as string).toMatch(/^https?:\/\//);
    expect(msg).toMatch(/https?:\/\/[^\s]*\/api\/v1\/work-orders\/92\/pdf/);
  });

  it('renders the signed public PDF URL as an absolute clickable link', () => {
    const publicPdfUrl = buildPublicPdfUrl('work_order', 'abc.def', 'https://mi.afamar.com');
    const msg = buildDocumentShareMessage({
      documentLabel: 'la Orden de Trabajo',
      pdfUrl: publicPdfUrl,
      pdfLabel: 'PDF de la Orden',
    });
    expect(msg).toContain('📄 Ver / Descargar PDF de la Orden:');
    expect(msg).toContain('https://mi.afamar.com/api/v1/public/work-orders/pdf?token=abc.def');
    const pdfLine = msg.split('\n').find((l) => l.includes('/public/work-orders/pdf'));
    expect(pdfLine as string).toMatch(/^https?:\/\//);
  });

  it('appends the exact Payway payment block at the end of the message', () => {
    const msg = buildDocumentShareMessage({
      clientName: 'María',
      documentLabel: 'la Orden de Trabajo',
      pdfUrl: '',
      paywayLink: PAYWAY,
    });
    expect(msg).toContain(
      `\n\n💳 Link de pago seguro (Payway):\n${PAYWAY}\n\n¡Muchas gracias!`,
    );
    expect(msg.endsWith('¡Muchas gracias!')).toBe(true);
    expect(msg.indexOf('Payway')).toBeGreaterThan(msg.indexOf('AFAMAR'));
  });

  it('keeps the message Payway-free when paywayLink is null/empty', () => {
    for (const paywayLink of [undefined, null, '']) {
      const msg = buildDocumentShareMessage({
        documentLabel: 'la Orden de Trabajo',
        pdfUrl: '',
        paywayLink,
      });
      expect(msg).not.toContain('Payway');
      expect(msg).not.toContain('¡Muchas gracias!');
    }
  });
});

describe('buildOrderShareMessage', () => {
  const orderInput = {
    clientName: 'María',
    documentLabel: 'la Orden de Trabajo',
    documentNumber: 'A-000090',
    pdfUrl: 'https://afamar.com/orden-a-000090.pdf',
    paywayLink: PAYWAY,
    currency: 'ARS',
    total: 1234567,
    depositReceived: 400000,
    balanceDue: 834567,
    materials: [
      { name: 'NEGRO BRASIL', quantity: 1, length: 2.1, width: 0.6, is_alternative: false },
      { name: 'GRIS MARA', quantity: 2, length: 1.5, width: 0.5, is_alternative: false },
      { name: 'ZIRCONIUM', quantity: 1, length: 1, width: 1, is_alternative: true },
    ],
  };

  it('contains the Work Order summary (number, materials, totals) AND the Payway link', () => {
    const msg = buildOrderShareMessage(orderInput);

    // Order header: greeting + number.
    expect(msg).toContain('Hola María!');
    expect(msg).toContain('N° A-000090');

    // Detail only includes the MAIN materials (alternatives are excluded).
    expect(msg).toContain('• NEGRO BRASIL ×1 (2.1×0.6 m)');
    expect(msg).toContain('• GRIS MARA ×2 (1.5×0.5 m)');
    expect(msg).not.toContain('ZIRCONIUM');

    // Money rows in ARS with es-AR formatting.
    expect(msg).toContain('Total: $ 1.234.567,00');
    expect(msg).toContain('Seña recibida: $ 400.000,00');
    expect(msg).toContain('Saldo pendiente: $ 834.567,00');

    // Exact Payway block at the very end.
    expect(msg).toContain(
      `\n\n💳 Link de pago seguro (Payway):\n${PAYWAY}\n\n¡Muchas gracias!`,
    );
    expect(msg.endsWith('¡Muchas gracias!')).toBe(true);
  });

  it('skips seña/saldo rows when they are zero (fully paid or no deposit)', () => {
    const msg = buildOrderShareMessage({
      ...orderInput,
      total: 1000000,
      depositReceived: 1000000,
      balanceDue: 0,
    });
    expect(msg).toContain('Total: $ 1.000.000,00');
    expect(msg).toContain('Seña recibida: $ 1.000.000,00');
    expect(msg).not.toContain('Saldo pendiente');
  });

  it('formats money in USD when the order currency is USD', () => {
    const msg = buildOrderShareMessage({
      ...orderInput,
      currency: 'USD',
      total: 900,
      depositReceived: 0,
      balanceDue: 900,
    });
    expect(msg).toContain('Total: US$ 900,00');
    expect(msg).not.toContain('Seña recibida');
    expect(msg).toContain('Saldo pendiente: US$ 900,00');
  });

  it('omits the Payway block when the order has no active checkout link', () => {
    const msg = buildOrderShareMessage({ ...orderInput, paywayLink: null });
    expect(msg).not.toContain('Payway');
    expect(msg).toContain('N° A-000090');
    expect(msg).toContain('Total: $ 1.234.567,00');
  });

  it('absolutizes a relative PDF API path so WhatsApp renders a clickable link', () => {
    // `getWorkOrderPdf` returns `/api/v1/work-orders/92/pdf` (relative).
    // A loopback origin is never used for share links → use a real origin.
    (globalThis as Record<string, unknown>).window = {
      ...(globalThis.window ?? {}),
      location: { origin: 'https://afamar-prod.com' },
    };
    const msg = buildOrderShareMessage({
      ...orderInput,
      pdfUrl: '/api/v1/work-orders/92/pdf',
    });
    const pdfLine = msg.split('\n').find((l) => l.includes('/work-orders/92/pdf'));
    expect(pdfLine).toBeDefined();
    expect(pdfLine as string).toMatch(/^https?:\/\//);
    expect(msg).toMatch(/📄 Ver \/ Descargar PDF de la Orden:\nhttps?:\/\/[^\s]*\/api\/v1\/work-orders\/92\/pdf/);
  });
});