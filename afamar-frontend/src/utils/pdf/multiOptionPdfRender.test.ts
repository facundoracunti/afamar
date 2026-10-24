/**
 * PDF multi-opción — el documento renderizado NO debe contener jerga
 * interna de control (2026-10-01).
 *
 * El presupuesto es un documento COMERCIAL para el cliente final: no puede
 * mencionar "opción ganadora", "se convierte en Orden de Trabajo" ni el
 * descuento de stock de piletas — son conceptos del taller.
 *
 * El test renderiza el PDF real (@react-pdf/renderer → buffer), infla sus
 * content streams (FlateDecode) y busca las cadenas prohibidas en el
 * texto impreso.
 */
import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { inflateSync } from 'node:zlib';
import DocumentPdf from '../../components/ui/PdfPreviewModal/DocumentPdf';
import { buildPdfData } from './buildPdfData';
import type { BudgetOption, BudgetPiece } from '../../types/budget';
import { INITIAL_FORM } from '../../hooks/entityFormConstants';

function piece(id: string, name: string, matName: string, priceM2: number): BudgetPiece {
  return {
    id,
    name,
    mainMaterial: {
      id: 1,
      name: matName,
      price_m2: priceM2,
      price_m2_usd: 0,
      currency: 'ARS',
      quantity: 1,
      m2_used: 0,
      m2_budgeted: 0,
      length: 2,
      width: 1,
      is_alternative: false,
    },
    mainMaterialRows: [],
    alternativeMaterials: [],
    fabrication_details: [],
    additional_works_data: JSON.stringify([
      {
        additional_work_id: 5,
        name: 'Traforo de pileta',
        materialName: '__GLOBAL__',
        quantity: 1,
        price: 60_000,
        total: 60_000,
        currency: 'ARS',
        type: 'flat',
        detail: null,
      },
    ]),
    pools: [
      {
        pool_id: 1,
        brand: 'JOHNSON',
        model: 'LUXOR COMPACT SI71A',
        price: 850_000,
        currency: 'ARS',
        quantity: 1,
        material: matName,
      },
    ],
  } as unknown as BudgetPiece;
}

function option(id: string, name: string, sel: boolean, pieces: BudgetPiece[]): BudgetOption {
  return { id, name, is_selected: sel, pieces };
}

const baseParams = {
  document_type: 'budget' as const,
  company: {
    company_name: 'AFAMAR',
    company_tagline: 'MÁRMOLES & GRANITOS',
    company_address: 'Córdoba',
    company_phone: '351',
    company_email: 'afamar@afamar.com',
    company_logo: '',
    pdf_footer: 'AFAMAR',
    budget_validity_text: 'Presupuesto válido por 30 días.',
  },
  globalTerms: { budget_terms: [], delivery_terms: [], warranty_text: [] },
  sketchImages: [],
};

/** Text of the PDF's pages in VISUAL order.
 *
 * The content streams are stored in the file in an arbitrary order, so
 * the visual order must be read from the page tree (`/Kids [...]`), and
 * each page's text from its own `/Contents` stream. This is what the
 * reader actually sees, page after page.
 */
async function pdfVisualPageTexts(buffer: Uint8Array): Promise<string[]> {
  const raw = new TextDecoder('latin1').decode(buffer);
  const kids = raw.match(/\/Kids\s*\[([^\]]*)\]/);
  if (!kids) return [];
  const pageRefs = [...kids[1].matchAll(/(\d+)\s+0\s+R/g)].map((m) => Number(m[1]));

  const texts: string[] = [];
  for (const ref of pageRefs) {
    // The object header must start a LINE — a binary stream may contain
    // the byte sequence "12 0 obj" and would match a naive indexOf.
    const header = new RegExp(`(?:^|[\\r\\n])${ref} 0 obj`);
    const m = header.exec(raw);
    if (!m) continue;
    const objStart = m.index + m[0].length;
    const objEnd = raw.indexOf('endobj', objStart);
    const body = raw.slice(objStart, objEnd < 0 ? undefined : objEnd);
    const contents = body.match(/\/Contents\s+(\d+)\s+0\s+R/);
    if (!contents) continue;
    texts.push(await streamTextOfObject(buffer, Number(contents[1])));
  }
  return texts;
}

/** Inflated text of the content stream of a given PDF object number. */
async function streamTextOfObject(
  buffer: Uint8Array,
  objNum: number,
): Promise<string> {
  const raw = new TextDecoder('latin1').decode(buffer);
  const header = new RegExp(`(?:^|[\\r\\n])${objNum} 0 obj`);
  const m = header.exec(raw);
  if (!m) return '';
  const objStart = m.index + m[0].length;
  const streamStart = raw.indexOf('stream', objStart);
  const streamEnd = raw.indexOf('endstream', streamStart);
  if (streamStart < 0 || streamEnd < 0) return '';
  // Skip the EOL right after the "stream" keyword.
  let from = streamStart + 'stream'.length;
  while (from < buffer.length && (buffer[from] === 13 || buffer[from] === 10)) from += 1;
  let to = streamEnd;
  while (to > from && (buffer[to - 1] === 13 || buffer[to - 1] === 10)) to -= 1;
  try {
    return extractStrings(
      new TextDecoder('latin1').decode(inflateSync(buffer.slice(from, to))),
    );
  } catch {
    return '';
  }
}

/** Text of every content stream, in FILE order.
 *
 * NOTE: the order of the streams inside the file is NOT the visual page
 * order (react-pdf does not guarantee it), so this helper must only be
 * used to assert things INSIDE one page — where the text order IS the
 * visual order.
 */
async function pdfPageTexts(buffer: Uint8Array): Promise<string[]> {
  const pages: string[] = [];
  const streamMark = new TextEncoder().encode('stream');
  const endMark = new TextEncoder().encode('endstream');

  let cursor = 0;
  for (;;) {
    const start = indexOfBytes(buffer, streamMark, cursor);
    if (start < 0) break;
    let from = start + streamMark.length;
    while (from < buffer.length && (buffer[from] === 13 || buffer[from] === 10)) from += 1;
    const end = indexOfBytes(buffer, endMark, from);
    if (end < 0) break;
    let to = end;
    while (to > from && (buffer[to - 1] === 13 || buffer[to - 1] === 10)) to -= 1;

    let content = '';
    try {
      content = new TextDecoder('latin1').decode(
        inflateSync(buffer.slice(from, to)),
      );
    } catch {
      content = '';
    }
    pages.push(extractStrings(content));

    cursor = end + endMark.length;
  }
  return pages;
}

/** Pull the printable strings out of an inflated content stream. */
function extractStrings(content: string): string {
  const parts: string[] = [];
  // Hex strings — react-pdf writes the text this way.
  const hexRe = /<([0-9a-fA-F\s]+)>/g;
  let h: RegExpExecArray | null;
  while ((h = hexRe.exec(content)) !== null) {
    const hex = h[1].replace(/\s+/g, '');
    if (hex.length % 2 !== 0 || hex.length === 0) continue;
    let decoded = '';
    for (let i = 0; i < hex.length; i += 2) {
      decoded += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    parts.push(decoded);
  }
  // Literal strings (some PDF producers use them).
  const litRe = /\((?:\\.|[^\\()])*\)/g;
  let t: RegExpExecArray | null;
  while ((t = litRe.exec(content)) !== null) {
    parts.push(t[0].slice(1, -1).replace(/\\([()\\])/g, '$1'));
  }
  return parts.join(' ');
}

/** Extract the printable text of a rendered PDF buffer.
 *
 * react-pdf compresses the content streams (FlateDecode) and writes the
 * text as HEX strings (`<4f706369>` → "Opci"), so the raw buffer exposes
 * only the PDF metadata. We inflate every stream and decode both the
 * literal `(...)` and the hex `<...>` string operands.
 */
async function pdfText(buffer: Uint8Array): Promise<string> {
  const parts: string[] = [];
  const streamMark = new TextEncoder().encode('stream');
  const endMark = new TextEncoder().encode('endstream');

  let cursor = 0;
  for (;;) {
    const start = indexOfBytes(buffer, streamMark, cursor);
    if (start < 0) break;
    // Skip the "stream" keyword and the EOL that follows it.
    let from = start + streamMark.length;
    while (from < buffer.length && (buffer[from] === 13 || buffer[from] === 10)) from += 1;
    const end = indexOfBytes(buffer, endMark, from);
    if (end < 0) break;
    let to = end;
    while (to > from && (buffer[to - 1] === 13 || buffer[to - 1] === 10)) to -= 1;

    let content = '';
    try {
      content = new TextDecoder('latin1').decode(
        inflateSync(buffer.slice(from, to)),
      );
    } catch {
      content = '';
    }

    parts.push(extractStrings(content));

    cursor = end + endMark.length;
  }
  return parts.join(' ');
}

/** Byte-level indexOf (the stream payloads are binary). */
function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** react-pdf splits a word across hex chunks when it kerns ("GRANIT OS"),
 *  so every comparison is made on the whitespace-stripped text. The PDF
 *  styles upper-case some titles (`textTransform`), hence the
 *  case-insensitive comparison. */
function normalize(s: string): string {
  return s.replace(/\s+/g, '').toUpperCase();
}

/** Number of pages in a rendered PDF buffer. */
function pageCount(buffer: Uint8Array): number {
  const raw = new TextDecoder('latin1').decode(buffer);
  // `/Type /Page` (singular) — the `/Pages` root node is not a page.
  const matches = raw.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

describe('PDF multi-opción — documento comercial sin jerga interna', () => {
  // react-pdf renders the whole document to a buffer — slow when the suite
  // runs in parallel, hence the generous timeout.
  const RENDER_TIMEOUT = 60_000;
  it('does not print "OPCIÓN GANADORA" nor the conversion/stock note', { timeout: RENDER_TIMEOUT }, async () => {
    const opt1 = option('opt-1', 'Opción 1', true, [
      piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000),
    ]);
    const opt2 = option('opt-2', 'Opción 2', false, [
      piece('p2', 'COCINA', 'MIAMI WHITE', 150_000),
    ]);
    const form = {
      ...INITIAL_FORM,
      options: [opt1, opt2],
      active_option_id: 'opt-1',
      pieces: opt1.pieces,
      usd_rate: 1000,
    } as unknown as Record<string, unknown>;

    const data = buildPdfData({ ...baseParams, form, overrides: {} });
    const buffer = await renderToBuffer(
      React.createElement(DocumentPdf, { data }) as never,
    );
    const text = normalize(await pdfText(buffer));

    // The internal control vocabulary must NOT reach the client.
    expect(text).not.toMatch(/OPCIÓNGANADORA/i);
    expect(text).not.toMatch(/seconvierteenOrdenDeTrabajo/i);
    expect(text).not.toMatch(/descuentaelstock/i);
    expect(text).not.toMatch(/stockdelaspiletas/i);
  });

  it('prints every option with its detail and final price', { timeout: RENDER_TIMEOUT }, async () => {
    const opt1 = option('opt-1', 'Opción 1', true, [
      piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000),
    ]);
    const opt2 = option('opt-2', 'Opción 2', false, [
      piece('p2', 'ALZADA', 'BLANCO ZEN MATE', 150_000),
    ]);
    const form = {
      ...INITIAL_FORM,
      options: [opt1, opt2],
      active_option_id: 'opt-1',
      pieces: opt1.pieces,
      usd_rate: 1000,
    } as unknown as Record<string, unknown>;

    const data = buildPdfData({ ...baseParams, form, overrides: {} });
    const buffer = await renderToBuffer(
      React.createElement(DocumentPdf, { data }) as never,
    );
    const text = normalize(await pdfText(buffer));

    // Both options are detailed (their own pieces + materials).
    expect(text).toContain(normalize('Opción 1'));
    expect(text).toContain(normalize('Opción 2'));
    expect(text).toContain('COCINA');
    expect(text).toContain('ALZADA');
    expect(text).toContain('NEGROBRASIL');
    expect(text).toContain('BLANCOZENMATE');
    // Each option closes with its own total.
    expect(text).toContain(normalize('TOTAL DE LA OPCIÓN'));
    // The commercial summary is there.
    expect(text).toContain(normalize('Comparativa de opciones'));
  });

  it('gives every option its own consecutive page', { timeout: RENDER_TIMEOUT }, async () => {
    const opt1 = option('opt-1', 'Opción 1', true, [
      piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000),
    ]);
    const opt2 = option('opt-2', 'Opción 2', false, [
      piece('p2', 'ALZADA', 'BLANCO ZEN MATE', 150_000),
    ]);
    const opt3 = option('opt-3', 'Opción 3', false, [
      piece('p3', 'PARRILLA', 'GRIS MARA', 180_000),
    ]);
    const form = {
      ...INITIAL_FORM,
      options: [opt1, opt2, opt3],
      active_option_id: 'opt-1',
      pieces: opt1.pieces,
      usd_rate: 1000,
    } as unknown as Record<string, unknown>;

    const data = buildPdfData({ ...baseParams, form, overrides: {} });
    const buffer = await renderToBuffer(
      React.createElement(DocumentPdf, { data }) as never,
    );

    // 1 comparison page + 1 page per option.
    expect(pageCount(buffer)).toBe(4);

    const text = normalize(await pdfText(buffer));
    expect(text).toContain(normalize('Opción 3'));
    expect(text).toContain('PARRILLA');
    expect(text).toContain('GRISMARA');
  });

  it('orders the options CHEAPEST FIRST on the cover and in the detail pages', { timeout: RENDER_TIMEOUT }, async () => {
    // Prices: BLANCO ZEN MATE 150.000/m² (cheapest) < NEGRO BRASIL
    // 300.000/m² < MIAMI WHITE 400.000/m² (priciest). The cheapest must
    // be printed FIRST.
    const opt1 = option('opt-1', 'Opción 1', true, [
      piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000),
    ]);
    const opt2 = option('opt-2', 'Opción 2', false, [
      piece('p2', 'COCINA', 'MIAMI WHITE', 400_000),
    ]);
    const opt3 = option('opt-3', 'Opción 3', false, [
      piece('p3', 'ALZADA', 'BLANCO ZEN MATE', 150_000),
    ]);
    const form = {
      ...INITIAL_FORM,
      options: [opt1, opt2, opt3],
      active_option_id: 'opt-1',
      pieces: opt1.pieces,
      usd_rate: 1000,
    } as unknown as Record<string, unknown>;

    const data = buildPdfData({ ...baseParams, form, overrides: {} });
    const buffer = await renderToBuffer(
      React.createElement(DocumentPdf, { data }) as never,
    );

    // The order is asserted INSIDE the cover page (the stream order in the
    // file is not the visual page order, but within a page it is).
    const pages = (await pdfPageTexts(buffer)).map(normalize);
    const cover = pages.find((p) => p.includes(normalize('Comparativa de opciones'))) || '';
    expect(cover).not.toBe('');

    const cheapest = cover.indexOf(normalize('BLANCO ZEN MATE'));
    const middle = cover.indexOf(normalize('NEGRO BRASIL'));
    const priciest = cover.indexOf(normalize('MIAMI WHITE'));
    expect(cheapest).toBeGreaterThanOrEqual(0);
    expect(middle).toBeGreaterThan(cheapest);
    expect(priciest).toBeGreaterThan(middle);

    // The cheapest carries the commercial badge, and the prices ascend.
    expect(cover).toContain(normalize('MÁS ECONÓMICA'));

    // The DETAIL pages follow the same order, in VISUAL order (read from
    // the PDF's page tree): each one closes with its own "TOTAL DE LA
    // OPCIÓN", and the totals ascend page after page.
    const visualPages = (await pdfVisualPageTexts(buffer)).map(normalize);
    const detailPages = visualPages.filter((p) =>
      p.includes(normalize('TOTAL DE LA OPCIÓN')),
    );
    expect(detailPages).toHaveLength(3);
    const detailTotals = detailPages.map((p) => {
      const m = p.match(/\$([\d.]+,\d\d)\(USD/);
      return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : 0;
    });
    expect(detailTotals).toEqual([...detailTotals].sort((a, b) => a - b));
    // 300.000 material + 60.000 traforo + 850.000 pileta (the cheapest).
    expect(detailTotals[0]).toBe(1_210_000);
    expect(detailTotals[2]).toBe(1_710_000);

    // And the cover is the FIRST page of the document.
    expect(visualPages[0]).toContain(normalize('Comparativa de opciones'));
  });

  it('prints the pileta of each option and the commercial conditions ONCE', { timeout: RENDER_TIMEOUT }, async () => {
    const opt1 = option('opt-1', 'Opción 1', true, [
      piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000),
    ]);
    const opt2 = option('opt-2', 'Opción 2', false, [
      piece('p2', 'ALZADA', 'BLANCO ZEN MATE', 150_000),
    ]);
    const form = {
      ...INITIAL_FORM,
      options: [opt1, opt2],
      active_option_id: 'opt-1',
      pieces: opt1.pieces,
      usd_rate: 1000,
    } as unknown as Record<string, unknown>;

    const data = buildPdfData({
      ...baseParams,
      form,
      overrides: {},
      paymentMethods: [
        { id: 1, name: 'EFECTIVO', label: 'Efectivo', color: '', is_active: true, sort_order: 1, type: 'NONE', value: 0, is_percentage: false, applies_to_installments: false },
      ],
    });
    const buffer = await renderToBuffer(
      React.createElement(DocumentPdf, { data }) as never,
    );
    const pages = (await pdfPageTexts(buffer)).map(normalize);
    const cover = pages.find((p) => p.includes(normalize('Comparativa de opciones'))) || '';
    expect(cover).not.toBe('');

    // (a) The "Resumen del Proyecto" card is GONE — the cover opens with
    // the comparison title and the option cards.
    expect(cover).not.toContain(normalize('Resumen del proyecto'));
    expect(cover).not.toContain(normalize('Superficie total'));
    expect(cover).not.toContain(normalize('Piezas / ambientes'));

    // (b) Each option card shows the pileta it includes.
    expect(cover).toContain(normalize('Pileta'));
    expect(cover).toContain('JOHNSON');

    // (c) The commercial conditions block — validity + exchange rate —
    // printed ONCE, and NO duplicate payment block (the document already
    // prints the "Método de pago" box in its terms).
    expect(cover).toContain(normalize('Condiciones comerciales'));
    expect(cover).toContain(normalize('Validez de la oferta'));
    expect(cover).toContain(normalize('Cotización de referencia'));
    const occurrences = cover.split(normalize('Metodo de pago')).length - 1;
    expect(occurrences).toBe(1);
    const modalidades = cover.split(normalize('Modalidades de pago')).length - 1;
    expect(modalidades).toBe(0);
  });
});
