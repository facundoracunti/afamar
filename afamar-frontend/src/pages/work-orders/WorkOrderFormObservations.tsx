import React from 'react';
import ObservationsSection from '../../components/features/orders/ObservationsSection';
import styles from './WorkOrderFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface WorkOrderFormObservationsProps {
  form: import('../../types').EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
}

export default function WorkOrderFormObservations({
  form,
  readOnly,
  update,
}: WorkOrderFormObservationsProps) {
  return (
    <ObservationsSection
      form={form}
      readOnly={readOnly}
      update={update as (field: string, value: unknown) => void}
      className={s['work-order-form__card']}
      titleClassName={s['work-order-form__card-title']}
    />
  );
}