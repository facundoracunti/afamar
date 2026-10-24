/**
 * Client card of the measurement form (right column).
 *
 * Extracted verbatim from `MeasurementFormPage.tsx`.
 */
import React from 'react';
import ClientInfoCard from '../../components/orders/ClientInfoCard/ClientInfoCard';
import type { Client } from '../../types/client';
import styles from './MeasurementFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface MeasurementClientCardProps {
  client?: Client;
}

export function MeasurementClientCard({ client }: MeasurementClientCardProps) {
  return (
    <div className={s['measurement-form__card']}>
      <ClientInfoCard client={client} />
    </div>
  );
}
