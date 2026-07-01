import type { CSSProperties } from 'react';

export interface EstadoBadgeProps {
  estado: string;
  variant?: string;
  style?: CSSProperties;
}

export function EstadoBadge({ estado, style }: EstadoBadgeProps) {
  return <span className={`badge badge--${estado}`} style={style}>{estado}</span>;
}

export default EstadoBadge;
