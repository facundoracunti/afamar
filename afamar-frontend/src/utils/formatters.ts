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

export const thicknesses: string[] = ['2 cm', '1.2 cm'];
export const finishes: string[] = ['PULIDO', 'LAPIDADO', 'FLAMEADO', 'CEPILLADO'];
export const fabricationConcepts: string[] = ['LONGITUD', 'ZÓCALO', 'FRENTE', 'TRAFORO DE PILETA', 'TRAFORO DE ANAFE', 'TRAFORO DE PILETA DE APOYO', 'OTRA'];
export const materialCategories: string[] = ['Granitos', 'Cuarzos', 'Sinterizados', 'Mármoles'];

export const orderStatuses: string[] = ['MEDICION', 'TALLER', 'TERMINADA', 'ENTREGADA'];
export const budgetStatuses: string[] = ['PENDIENTE', 'ENVIADO', 'APROBADO', 'RECHAZADO'];

export const measurementStatuses: string[] = ['PENDING', 'CONFIRMED', 'DONE', 'CANCELLED'];
export const M2_CONCEPTS: string[] = ['ZÓCALO', 'FRENTE'];
