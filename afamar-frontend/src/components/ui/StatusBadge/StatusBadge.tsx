import React, { memo, type HTMLAttributes } from 'react';
import { t } from '../../../utils/translate';
import { STATUS_META } from '../../../constants/status';
import styles from './StatusBadge.module.css';

const s = styles as unknown as Record<string, string>;

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status?: string | null;
}

export const StatusBadge = memo(function StatusBadge({
  status,
  style,
  children,
  ...rest
}: StatusBadgeProps) {
  const safe = status ?? '';
  const meta = STATUS_META[safe];
  return (
    <span
      className={s['badge']}
      style={{ backgroundColor: meta?.bg, color: meta?.color, ...style }}
      {...rest}
    >
      {children ?? t(safe)}
    </span>
  );
});

export default StatusBadge;
