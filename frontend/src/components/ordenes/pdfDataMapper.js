export function buildPdfData(form, opts = {}) {
  const { materialesCatalogo = [], logoUrl = '', portadaUrl = '' } = opts;

  const materiales = (form.materiales || []).map((m) => {
    const catalogo = materialesCatalogo.find((c) => c.nombre === m.nombre) || {};
    return {
      nombre: m.nombre,
      categoria: m.categoria || catalogo.categoria || '',
      color: m.color || catalogo.color || '',
      espesor: m.espesor || catalogo.espesor || '',
      acabado: m.acabado || catalogo.acabado || '',
      precio_m2: m.precio_m2 || catalogo.precio_m2 || 0,
      precio_m2_usd: m.precio_m2_usd || catalogo.precio_m2_usd || 0,
      moneda: m.moneda || 'ARS',
      m2: Number(m.largo || 0) * Number(m.ancho || 0) * (m.cantidad || 1),
      cantidad: m.cantidad || 1,
    };
  });

  const fabricacion = (form.detalles_fabricacion || []).map((d) => ({
    concepto: d.concepto || '',
    detalle: d.detalle || '',
    material: d.material || '',
    largo: d.largo || 0,
    ancho: d.ancho || 0,
    m2: d.m2 || 0,
    precio: d.precio || 0,
    moneda: d.moneda || 'ARS',
    cantidad: d.cantidad || 1,
  }));

  const piletas = (form.piletas || []).map((pt) => ({
    nombre: `${pt.marca || ''} ${pt.modelo || ''}`.trim(),
    marca: pt.marca || '',
    modelo: pt.modelo || '',
    cantidad: pt.cantidad || 1,
    precio: pt.precio || 0,
    moneda: pt.moneda || 'ARS',
  }));

  const observaciones = (form.observaciones_importantes || '')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => l.replace(/^[✓✅]\s*/, '').trim());

  const obsDefault = [
    'No realizamos instalaciones',
    'La descarga se realiza al pie del camión',
    'Debe haber personal presente para la descarga',
    'Entregas sujetas a condiciones climáticas',
  ];

  const allObs = observaciones.length > 0 ? observaciones : obsDefault;

  return {
    presupuestoNumero: form.numero || 'P-_____',
    clienteNombre: form.cliente_nombre || '',
    clienteTelefono: form.cliente_telefono_orden || '',
    clienteEmail: form.email || '',
    clienteDomicilio: form.domicilio || '',
    proyectoFecha: form.fecha || null,
    projetoTipo: form.tipo_obra || 'Mesada de cocina',
    proyectoMaterial:
      materiales.length > 0
        ? materiales[0].nombre
        : form.material || '',
    proyectoEspesor: form.espesor || '',
    proyectoAcabado: form.acabado || '',
    materiales,
    fabricacion,
    piletas,
    subtotalArs: form.subtotal || 0,
    traslado: form.traslado || 0,
    totalArs: form.total || 0,
    dolarDia: form.dolar_dia || 0,
    formaPago: form.forma_pago || '',
    cuotas: form.cuotas || 1,
    observaciones: allObs,
    logoUrl: logoUrl || '',
    portadaUrl: portadaUrl || '',
  };
}
