export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
};

export const formatDate = (date: string | undefined | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-AR');
};

export const formatInputDate = (date: string | undefined | null): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

export const espesores: string[] = ['2 cm', '1.2 cm'];
export const acabados: string[] = ['PULIDO', 'LAPIDADO', 'FLAMEADO', 'CEPILLADO'];
export const conceptosFabricacion: string[] = ['LONGITUD', 'ZÓCALO', 'FRENTE', 'TRAFORO DE PILETA', 'TRAFORO DE ANAFE', 'TRAFORO DE PILETA DE APOYO', 'OTRA'];
export const categoriasMaterial: string[] = ['Granitos', 'Cuarzos', 'Sinterizados', 'Mármoles'];

export const estadosOrden: string[] = ['MEDICION', 'TALLER', 'TERMINADA', 'ENTREGADA'];
export const estadosPresupuestoLocal: string[] = ['PENDIENTE', 'ENVIADO', 'APROBADO', 'RECHAZADO'];

export const estadosMedicion: string[] = ['PENDIENTE', 'CONFIRMADA', 'REALIZADA', 'CANCELADA'];
export const CONCEPTOS_M2: string[] = ['ZÓCALO', 'FRENTE'];
