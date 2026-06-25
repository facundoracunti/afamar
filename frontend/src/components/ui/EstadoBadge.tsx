import React from 'react';
import Badge from './Badge';

interface EstadoBadgeProps {
  estado: string;
  style?: React.CSSProperties;
}

const estadoToVariant: Record<string, string> = {
  PENDIENTE: 'pending',
  ENVIADO: 'pending',
  APROBADO: 'approved',
  RECHAZADO: 'rejected',
  'CONVERTIDO A OT': 'converted',
  MEDICION: 'pending',
  TALLER: 'production',
  TERMINADA: 'completed',
  ENTREGADA: 'delivered',
  CONCRETADO: 'completed',
  CONFIRMADA: 'approved',
  REALIZADA: 'completed',
  CANCELADA: 'cancelled',
  Presupuestado: 'pending',
  'En producción': 'production',
  Terminado: 'completed',
  Entregado: 'delivered',
  Cancelado: 'cancelled',
  Convertido: 'converted',
};

const estadoToLabel: Record<string, string> = {
  MEDICION: 'EN MEDICIÓN',
  TALLER: 'EN EL TALLER',
  TERMINADA: 'TERMINADA',
  ENTREGADA: 'ENTREGADA',
};

export default function EstadoBadge({ estado, style }: EstadoBadgeProps) {
  const variant = estadoToVariant[estado] || 'pending';
  const label = estadoToLabel[estado] || estado;
  return <Badge variant={variant as any} style={style}>{label}</Badge>;
}
