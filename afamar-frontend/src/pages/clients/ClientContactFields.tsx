/**
 * Contact fields of the client form (nombre / teléfono / correo / dirección).
 *
 * Extracted verbatim from `ClientFormPage.tsx`: the SAME fields are rendered
 * in create mode and in edit mode, so they live in one shared component.
 */
import React from 'react';
import styles from './ClientFormPage.module.css';

const s = styles as unknown as Record<string, string>;

/** Values of the client form. */
export type ClientFormValues = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

interface ClientContactFieldsProps {
  values: ClientFormValues;
  onChange: (field: keyof ClientFormValues, value: string) => void;
}

export function ClientContactFields({ values, onChange }: ClientContactFieldsProps) {
  return (
    <>
      <div className={s['client-form__form-row']}>
        <div className={s['client-form__group']}>
          <label className={s['client-form__label']}>Nombre *</label>
          <input className="input" required value={values.name} onChange={(e) => onChange('name', e.target.value)} />
        </div>
        <div className={s['client-form__group']}>
          <label className={s['client-form__label']}>Teléfono</label>
          <input className="input" value={values.phone || ''} onChange={(e) => onChange('phone', e.target.value)} />
        </div>
      </div>
      <div className={s['client-form__form-row']}>
        <div className={s['client-form__group']}>
          <label className={s['client-form__label']}>Correo</label>
          <input className="input" type="email" value={values.email || ''} onChange={(e) => onChange('email', e.target.value)} />
        </div>
        <div className={s['client-form__group']}>
          <label className={s['client-form__label']}>Dirección</label>
          <input className="input" value={values.address || ''} onChange={(e) => onChange('address', e.target.value)} />
        </div>
      </div>
    </>
  );
}
