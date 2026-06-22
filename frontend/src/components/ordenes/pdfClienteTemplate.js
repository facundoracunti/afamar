import { COLORS, formatARS, formatDate } from './pdfTheme';
import { PORTADA_FOTO_REAL } from './pdfAssets';

function header(data) {
  return [
    {
      columns: [
        { text: 'AFAMAR', bold: true, fontSize: 16, color: '#fff', alignment: 'left', width: '*' },
        { text: data.presupuestoNumero, fontSize: 11, color: '#fff', alignment: 'right', width: 'auto', margin: [0, 4, 0, 0] },
      ],
      margin: [18, 0, 18, 0],
    },
  ];
}

function contentPageFooter(currentPage, pageCount) {
  if (currentPage === 1) return null;
  return {
    margin: [18, 0, 18, 0],
    stack: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 559, y2: 0, lineWidth: 0.5, lineColor: COLORS.border }] },
      { text: 'AFAMAR · Av.72 Nº1438 e/23 y 24 · La Plata · +54 221 411 1348 · @afamarsrl', fontSize: 7, color: '#9CA3AF', alignment: 'center', margin: [0, 4, 0, 2] },
      { text: `${currentPage} / ${pageCount}`, fontSize: 7, color: '#9CA3AF', alignment: 'center' },
    ],
  };
}

function heroImage(data) {
  const url = data.portadaUrl || PORTADA_FOTO_REAL;
  return {
    image: url,
    width: 515,
    height: 180,
    alignment: 'center',
    margin: [0, 0, 0, 8],
  };
}

function clienteProyectoCards(data) {
  const cardStyle = {
    border: [true, true, true, true],
    borderColor: [COLORS.border, COLORS.border, COLORS.border, COLORS.border],
    fillColor: '#fff',
    padding: [14, 14, 14, 14],
    margin: [0, 0, 0, 0],
  };

  const labelValueStyle = { fontSize: 9, color: COLORS.textMuted, margin: [0, 0, 0, 2] };

  const clientCard = {
    ...cardStyle,
    stack: [
      { text: 'CLIENTE', fontSize: 9, bold: true, color: COLORS.textMuted, characterSpacing: 1, margin: [0, 0, 0, 4] },
      { text: data.clienteNombre || '-', fontSize: 14, bold: true, color: COLORS.primary, margin: [0, 0, 0, 6] },
      { text: `📞 ${data.clienteTelefono || '-'}`, ...labelValueStyle },
      { text: `✉ ${data.clienteEmail || '-'}`, ...labelValueStyle },
      { text: `📍 ${data.clienteDomicilio || '-'}`, ...labelValueStyle },
    ],
  };

  const projectCard = {
    ...cardStyle,
    stack: [
      { text: 'PROYECTO', fontSize: 9, bold: true, color: COLORS.textMuted, characterSpacing: 1, margin: [0, 0, 0, 6] },
      { text: [{ text: 'Tipo: ', fontSize: 9, color: COLORS.textMuted }, { text: data.projetoTipo || '-', fontSize: 10, bold: true, color: COLORS.textDark }], margin: [0, 0, 0, 2] },
      { text: [{ text: 'Material: ', fontSize: 9, color: COLORS.textMuted }, { text: data.proyectoMaterial || '-', fontSize: 10, bold: true, color: COLORS.textDark }], margin: [0, 0, 0, 2] },
      { text: [{ text: 'Espesor: ', fontSize: 9, color: COLORS.textMuted }, { text: data.proyectoEspesor || '-', fontSize: 10, bold: true, color: COLORS.textDark }], margin: [0, 0, 0, 2] },
      { text: [{ text: 'Acabado: ', fontSize: 9, color: COLORS.textMuted }, { text: data.proyectoAcabado || '-', fontSize: 10, bold: true, color: COLORS.textDark }], margin: [0, 0, 0, 0] },
    ],
  };

  return {
    columns: [
      { width: '50%', stack: [clientCard] },
      { width: '50%', stack: [projectCard] },
    ],
    columnGap: 12,
    margin: [0, 0, 0, 12],
  };
}

function materialesSection(data) {
  if (!data.materiales || data.materiales.length === 0) return null;
  const items = data.materiales.map((m) => {
    const precioLabel = m.moneda === 'USD'
      ? `USD ${(m.precio_m2_usd || 0).toLocaleString('es-AR')} / m²`
      : `$ ${(m.precio_m2 || 0).toLocaleString('es-AR')} / m²`;
    const badge = m.categoria
      ? { text: m.categoria, fontSize: 8, color: COLORS.textMuted, background: COLORS.bgLight, padding: [4, 2, 4, 2], margin: [0, 0, 0, 4] }
      : null;
    return {
      stack: [
        { text: m.nombre.toUpperCase(), fontSize: 12, bold: true, color: COLORS.primary, margin: [0, 0, 0, 2] },
        badge,
        { text: `Espesor: ${m.espesor || '-'}  |  Acabado: ${m.acabado || '-'}`, fontSize: 9, color: COLORS.textMuted, margin: [0, 0, 0, 2] },
        { text: precioLabel, fontSize: 9, color: m.moneda === 'USD' ? COLORS.accent : COLORS.textDark, margin: [0, 0, 0, 4] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.3, lineColor: COLORS.border }] },
      ],
      margin: [0, 0, 0, 8],
    };
  });
  return {
    stack: [
      { text: 'MATERIAL', fontSize: 9, bold: true, color: COLORS.textMuted, characterSpacing: 1, margin: [0, 0, 0, 6] },
      {
        border: [true, true, true, true],
        borderColor: [COLORS.border, COLORS.border, COLORS.border, COLORS.border],
        fillColor: '#fff',
        padding: [14, 14, 14, 14],
        stack: items,
      },
    ],
    margin: [0, 0, 0, 12],
  };
}

function fabricacionSection(data) {
  if (!data.fabricacion || data.fabricacion.length === 0) return null;
  const body = [
    [
      { text: 'Concepto', bold: true, fontSize: 8, color: COLORS.textMuted, fillColor: COLORS.bgLight, border: [false, false, false, true], borderColor: [null, null, null, COLORS.border] },
      { text: 'Detalle', bold: true, fontSize: 8, color: COLORS.textMuted, fillColor: COLORS.bgLight, border: [false, false, false, true], borderColor: [null, null, null, COLORS.border] },
      { text: 'Material', bold: true, fontSize: 8, color: COLORS.textMuted, fillColor: COLORS.bgLight, border: [false, false, false, true], borderColor: [null, null, null, COLORS.border] },
      { text: 'M²', bold: true, fontSize: 8, color: COLORS.textMuted, fillColor: COLORS.bgLight, border: [false, false, false, true], borderColor: [null, null, null, COLORS.border], alignment: 'right' },
      { text: 'Precio', bold: true, fontSize: 8, color: COLORS.textMuted, fillColor: COLORS.bgLight, border: [false, false, false, true], borderColor: [null, null, null, COLORS.border], alignment: 'right' },
    ],
  ];
  data.fabricacion.forEach((d) => {
    body.push([
      { text: d.concepto, fontSize: 8, color: COLORS.textDark, border: [false, false, false, true], borderColor: [null, null, null, COLORS.border] },
      { text: d.detalle || '-', fontSize: 8, color: COLORS.textDark, border: [false, false, false, true], borderColor: [null, null, null, COLORS.border] },
      { text: d.material || '-', fontSize: 8, color: COLORS.textDark, border: [false, false, false, true], borderColor: [null, null, null, COLORS.border] },
      { text: d.m2 ? `${d.m2.toFixed(4)}` : '-', fontSize: 8, color: COLORS.textDark, border: [false, false, false, true], borderColor: [null, null, null, COLORS.border], alignment: 'right' },
      { text: d.moneda === 'USD' ? `USD ${Number(d.precio).toLocaleString('es-AR')}` : `$ ${Number(d.precio).toLocaleString('es-AR')}`, fontSize: 8, color: d.moneda === 'USD' ? COLORS.accent : COLORS.textDark, border: [false, false, false, true], borderColor: [null, null, null, COLORS.border], alignment: 'right' },
    ]);
  });
  return {
    stack: [
      { text: 'FABRICACIÓN', fontSize: 9, bold: true, color: COLORS.textMuted, characterSpacing: 1, margin: [0, 0, 0, 6] },
      {
        border: [true, true, true, true],
        borderColor: [COLORS.border, COLORS.border, COLORS.border, COLORS.border],
        fillColor: '#fff',
        padding: [10, 10, 10, 10],
        table: { widths: ['auto', '*', 'auto', 'auto', 'auto'], body },
        layout: 'noBorders',
      },
    ],
    margin: [0, 0, 0, 12],
  };
}

function piletasSection(data) {
  if (!data.piletas || data.piletas.length === 0) return null;
  const items = data.piletas.map((pt) => {
    const precioLabel = pt.moneda === 'USD'
      ? `USD ${(pt.precio || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
      : `$ ${(pt.precio || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    return {
      columns: [
        { text: pt.nombre || `${pt.marca} ${pt.modelo}`.trim(), fontSize: 10, bold: true, color: COLORS.textDark, width: '*' },
        { text: pt.cantidad > 1 ? `x${pt.cantidad}` : '', fontSize: 9, color: COLORS.textMuted, width: 'auto', margin: [0, 0, 8, 0] },
        { text: precioLabel, fontSize: 10, color: pt.moneda === 'USD' ? COLORS.accent : COLORS.textDark, width: 'auto', alignment: 'right' },
      ],
      margin: [0, 0, 0, 4],
    };
  });
  return {
    stack: [
      { text: 'PILETAS', fontSize: 9, bold: true, color: COLORS.textMuted, characterSpacing: 1, margin: [0, 0, 0, 6] },
      {
        border: [true, true, true, true],
        borderColor: [COLORS.border, COLORS.border, COLORS.border, COLORS.border],
        fillColor: '#fff',
        padding: [14, 14, 14, 14],
        stack: items,
      },
    ],
    margin: [0, 0, 0, 12],
  };
}

function economicSummary(data) {
  const cuotaText = data.cuotas > 1 && data.totalArs > 0
    ? `${data.cuotas} cuotas mensuales fijas de ${formatARS(Math.round((data.totalArs || 0) / (data.cuotas || 1)))}`
    : null;
  return {
    stack: [
      { text: 'RESUMEN ECONÓMICO', fontSize: 10, bold: true, color: COLORS.textMuted, characterSpacing: 1.5, alignment: 'center', margin: [0, 0, 0, 10] },
      {
        border: [true, true, true, true],
        borderColor: [COLORS.border, COLORS.border, COLORS.border, COLORS.border],
        fillColor: '#fff',
        padding: [16, 16, 16, 16],
        stack: [
          { columns: [{ text: 'Subtotal', fontSize: 11, color: COLORS.textDark, width: '*' }, { text: formatARS(data.subtotalArs), fontSize: 11, color: COLORS.textDark, width: 'auto', alignment: 'right' }], margin: [0, 0, 0, 4] },
          { columns: [{ text: 'Traslado', fontSize: 11, color: COLORS.textDark, width: '*' }, { text: formatARS(data.traslado), fontSize: 11, color: COLORS.textDark, width: 'auto', alignment: 'right' }], margin: [0, 0, 0, 6] },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 1.5, lineColor: COLORS.secondary }], margin: [0, 0, 0, 6] },
          { columns: [{ text: 'TOTAL FINAL', fontSize: 16, bold: true, color: COLORS.primary, width: '*' }, { text: formatARS(data.totalArs), fontSize: 18, bold: true, color: COLORS.secondary, width: 'auto', alignment: 'right' }], margin: [0, 0, 0, 4] },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 1.5, lineColor: COLORS.secondary }], margin: [0, 0, 0, 8] },
          data.formaPago ? { text: `Forma de pago: ${data.formaPago}`, fontSize: 9, color: COLORS.textMuted, margin: [0, 0, 0, 2] } : null,
          cuotaText ? { text: cuotaText, fontSize: 9, color: COLORS.secondary, bold: true, margin: [0, 2, 0, 0] } : null,
        ].filter(Boolean),
      },
    ],
    margin: [0, 0, 0, 12],
  };
}

function observacionesSection(data) {
  const items = data.observaciones.map((o) => ({
    text: `✓   ${o}`,
    fontSize: 9,
    color: '#991b1b',
    margin: [0, 0, 0, 3],
  }));
  return {
    stack: [
      { text: 'IMPORTANTE', fontSize: 9, bold: true, color: COLORS.secondary, characterSpacing: 1, margin: [0, 0, 0, 6] },
      {
        border: [true, true, true, true],
        borderColor: ['#FECACA', '#FECACA', '#FECACA', '#FECACA'],
        fillColor: '#FEF2F2',
        padding: [12, 12, 12, 12],
        stack: items,
      },
    ],
    margin: [0, 0, 0, 12],
  };
}

function thankYouContent() {
  return [
    { text: '', margin: [0, 280, 0, 0] },
    { text: 'Gracias por confiar en AFAMAR', fontSize: 28, bold: true, color: '#fff', alignment: 'center', margin: [0, 0, 0, 10] },
    { text: '40 años creando proyectos únicos', fontSize: 13, color: '#fff', alignment: 'center', margin: [0, 0, 0, 40] },
    { canvas: [{ type: 'line', x1: 258, y1: 0, x2: 338, y2: 0, lineWidth: 1, lineColor: '#fff' }], margin: [0, 0, 0, 40] },
    {
      columns: [
        { width: '40%', stack: [{ text: 'FIRMA AFAMAR', fontSize: 8, color: '#9CA3AF', alignment: 'center', margin: [0, 0, 0, 30] }, { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.5, lineColor: '#fff' }] }] },
        { width: '20%', text: '' },
        { width: '40%', stack: [{ text: 'FIRMA CLIENTE', fontSize: 8, color: '#9CA3AF', alignment: 'center', margin: [0, 0, 0, 30] }, { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.5, lineColor: '#fff' }] }] },
      ],
    },
    { text: '', margin: [0, 80, 0, 0] },
    { text: 'Documento no válido como factura. Presupuesto sujeto a modificaciones.', fontSize: 7, color: '#ffffff80', alignment: 'center' },
  ];
}

export function buildDocDefinition(data) {
  const coverContent = [
    { text: '', margin: [0, 200, 0, 0] },
    data.logoUrl ? { image: data.logoUrl, width: 100, alignment: 'center', margin: [0, 0, 0, 20] } : null,
    { text: 'AFAMAR', fontSize: 48, bold: true, color: '#fff', alignment: 'center', margin: [0, 0, 0, 8] },
    { text: 'MÁRMOLES · GRANITOS · CUARZOS', fontSize: 13, color: '#fff', alignment: 'center', characterSpacing: 3, margin: [0, 0, 0, 6] },
    { text: 'Desde 1986 · 40 años de experiencia', fontSize: 10, color: '#ffffffb3', alignment: 'center', margin: [0, 0, 0, 40] },
    { canvas: [{ type: 'line', x1: 268, y1: 0, x2: 328, y2: 0, lineWidth: 1, lineColor: '#fff' }], margin: [0, 0, 0, 30] },
    { text: 'PRESUPUESTO', fontSize: 14, bold: true, color: '#fff', alignment: 'center', characterSpacing: 2, margin: [0, 0, 0, 4] },
    { text: data.presupuestoNumero, fontSize: 28, bold: true, color: '#fff', alignment: 'center', margin: [0, 0, 0, 10] },
    { text: data.proyectoFecha ? formatDate(data.proyectoFecha) : '', fontSize: 10, color: '#ffffffb3', alignment: 'center', margin: [0, 0, 0, 20] },
    { text: data.clienteNombre || '', fontSize: 11, color: '#fff', alignment: 'center' },
  ].filter(Boolean);

  const contentPages = [
    { text: '', pageBreak: 'before' },
    heroImage(data),
    clienteProyectoCards(data),
    materialesSection(data),
    fabricacionSection(data),
    piletasSection(data),
    economicSummary(data),
    observacionesSection(data),
  ].filter(Boolean);

  return {
    pageSize: 'A4',
    pageMargins: [18, 60, 18, 40],
    background: function (currentPage, pageCount) {
      const url = data.portadaUrl || PORTADA_FOTO_REAL;
      const portadaImg = url
        ? [{ image: url, width: 595.28, height: 841.89, absolutePosition: { x: 0, y: 0 } }]
        : [{ canvas: [{ type: 'rect', x: 0, y: 0, w: 595.28, h: 841.89, color: COLORS.primary }] }];
      if (currentPage === 1) return portadaImg;
      if (currentPage === pageCount) return [{ canvas: [{ type: 'rect', x: -18, y: -60, w: 595.28, h: 841.89, color: COLORS.primary }] }];
      return [
        { canvas: [{ type: 'rect', x: -18, y: -60, w: 595.28, h: 50, color: COLORS.primary }] },
        { canvas: [{ type: 'rect', x: -18, y: 0, w: 595.28, h: 1, color: COLORS.border }] },
      ];
    },
    header: function (currentPage, pageCount) {
      if (currentPage === 1 || currentPage === pageCount) return null;
      return header(data);
    },
    footer: function (currentPage, pageCount) {
      if (currentPage === 1 || currentPage === pageCount) return null;
      return contentPageFooter(currentPage, pageCount);
    },
    content: [
      ...coverContent,
      { text: '', pageBreak: 'before' },
      ...contentPages.filter(Boolean),
      { text: '', pageBreak: 'before' },
      ...thankYouContent(),
    ],
    defaultStyle: {
      fontSize: 10,
      color: COLORS.textDark,
    },
  };
}
