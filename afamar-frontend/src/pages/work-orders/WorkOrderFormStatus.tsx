import React from 'react';
import { orderStatuses } from '../../utils/formatters';
import { t } from '../../utils/translate';
import type { EntityFormState } from '../../types';
import styles from './WorkOrderFormStatus.module.css';

const s = styles as unknown as Record<string, string>;

interface WorkOrderFormStatusProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
}

export default function WorkOrderFormStatus({
  form,
  readOnly,
  update,
}: WorkOrderFormStatusProps) {
  return (
    <div className="card">
      <h3 className="section-title">ESTADO Y PRIORIDAD</h3>
      <div className={s['work-order-form-status__grid']}>
        <div className="form-group">
          <label>Estado</label>
          <select
            className="input"
            value={form.status}
            onChange={(e) => update('status', e.target.value)}
            disabled={readOnly}
          >
            {orderStatuses.map((status) => (
              <option key={status} value={status}>{t(status)}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
