import React from 'react';
import ObservationsSection from '../../components/orders/ObservationsSection/ObservationsSection';
import styles from './BudgetFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface BudgetFormObservationsProps {
  form: import('../../types').EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
}

export default function BudgetFormObservations({
  form,
  readOnly,
  update,
}: BudgetFormObservationsProps) {
  return (
    <ObservationsSection
      form={form}
      readOnly={readOnly}
      update={update as (field: string, value: unknown) => void}
      className={s['budget-form__card']}
      titleClassName={s['budget-form__card-title']}
    />
  );
}