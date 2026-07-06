import type { CSSProperties, HTMLAttributes } from 'react';
import { t } from '../../../utils/translate';

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status?: string | null;
  variant?: string;
}

export function StatusBadge(props: StatusBadgeProps) {
  const { status, variant, style, children } = props;
  const safe = status ?? '';
  const variantKey = variant ?? safe;
  return (
    <span className={`badge badge--${variantKey}`} style={style as CSSProperties}>
      {children ?? t(safe)}
    </span>
  );
}

export default StatusBadge;