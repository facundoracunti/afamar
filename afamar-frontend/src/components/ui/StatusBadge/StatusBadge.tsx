import type { CSSProperties, HTMLAttributes } from 'react';

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status?: string | null;
  variant?: string;
}

export function StatusBadge(props: StatusBadgeProps) {
  const { status, variant, style, children } = props;
  const safe = status ?? '';
  return (
    <span className={`badge badge--${variant ?? safe}`} style={style as CSSProperties}>
      {children ?? safe}
    </span>
  );
}

export default StatusBadge;