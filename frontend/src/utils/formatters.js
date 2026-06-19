export const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(value || 0);
};

export const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const estadosPresupuesto = ['Pendiente', 'Aprobado', 'Rechazado', 'Convertido'];
export const estadosOrden = ['EN MEDICIÓN', 'EN EL TALLER', 'ENTREGADO'];
export const estadosPresupuestoLocal = ['PENDIENTE', 'ENVIADO', 'APROBADO', 'RECHAZADO'];
export const estadosMedicion = ['PENDIENTE', 'REALIZADA', 'CANCELADA'];
export const categoriasMaterial = ['Granitos', 'Cuarzos', 'Sinterizados', 'Mármoles'];
export const formasPago = ['Efectivo', 'Transferencia Bancaria', 'Tarjeta'];
export const acabados = ['Pulido', 'Leather', 'Apomazado'];
export const espesores = ['2 cm', '1.2 cm'];
export const materialesOrden = ['Granito', 'Mármol', 'Cuarzo', 'Dekton', 'Sinterizado'];
export const conceptosFabricacion = ['LONGITUD', 'ZÓCALO', 'FRENTE', 'TRAFORO DE PILETA', 'TRAFORO DE ANAFE', 'TRAFORO DE PILETA DE APOYO', 'OTRA']; // OTRA permite escribir concepto personalizado

export const badgeClass = (estado) => {
  const map = {
    'Pendiente': 'badge-pending',
    'Aprobado': 'badge-approved',
    'Rechazado': 'badge-rejected',
    'Presupuestado': 'badge-pending',
    'Producción': 'badge-production',
    'Terminado': 'badge-finished',
    'Entregado': 'badge-finished',
    'Cancelado': 'badge-rejected',
    'Convertido': 'badge-approved',
    'EN MEDICIÓN': 'badge-pending',
    'EN EL TALLER': 'badge-production',
    'ENTREGADO': 'badge-finished',
    'FINALIZADO': 'badge-finished',
    'PENDIENTE': 'badge-pending',
    'REALIZADA': 'badge-approved',
    'CANCELADA': 'badge-rejected',
    'ENVIADO': 'badge-production',
    'RECHAZADO': 'badge-rejected',
    'CONVERTIDO A OT': 'badge-finished',
  };
  return `badge ${map[estado] || 'badge-pending'}`;
};
