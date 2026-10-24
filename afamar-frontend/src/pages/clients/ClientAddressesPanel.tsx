/**
 * "Domicilios alternativos" panel of the client form (edit mode).
 *
 * Extracted verbatim from `ClientFormPage.tsx`: same styles, same texts, same
 * actions (agregar / editar / eliminar / hacer principal).
 */
import React from 'react';
import { Plus, X, Star, MapPin } from 'lucide-react';
import type { ClientAddress } from '../../types/client';
import styles from './ClientFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface ClientAddressesPanelProps {
  addresses: ClientAddress[];
  onOpenNew: () => void;
  onEdit: (address: ClientAddress) => void;
  onDelete: (address: ClientAddress) => void;
  onSetDefault: (address: ClientAddress) => void;
}

export function ClientAddressesPanel({
  addresses,
  onOpenNew,
  onEdit,
  onDelete,
  onSetDefault,
}: ClientAddressesPanelProps) {
  return (
    <div className={s['client-form__group']}>
      <div className={s['client-form__addresses-header']}>
        <label className={s['client-form__label']}>
          <MapPin size={14} aria-hidden="true" /> Domicilios alternativos
        </label>
        <button type="button" className="btn btn-outline" onClick={onOpenNew}>
          <Plus size={14} /> Agregar domicilio
        </button>
      </div>
      {addresses.length === 0 ? (
        <div className={s['client-form__item-empty']}>
          Sin domicilios alternativos. El domicilio de arriba se usa como principal.
        </div>
      ) : (
        <div className={s['client-form__addresses-list']}>
          {addresses.map((a) => (
            <div
              key={a.id}
              className={`${s['client-form__address-row']} ${a.is_default ? s['client-form__address-row--default'] : ''}`}
            >
              <div className={s['client-form__address-info']}>
                {a.label && (
                  <span className={s['client-form__address-label']}>{a.label}</span>
                )}
                <span className={s['client-form__address-text']}>{a.address}</span>
              </div>
              <div className={s['client-form__address-actions']}>
                {a.is_default ? (
                  <span className={s['client-form__address-default-badge']} title="Domicilio principal">
                    <Star size={12} fill="currentColor" aria-hidden="true" /> Principal
                  </span>
                ) : (
                  <button type="button" className="btn btn-outline" onClick={() => onSetDefault(a)} title="Marcar como domicilio principal">
                    Hacer principal
                  </button>
                )}
                <button type="button" className="btn btn-outline" onClick={() => onEdit(a)} aria-label="Editar domicilio">
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => onDelete(a)}
                  aria-label="Eliminar domicilio"
                  disabled={addresses.length <= 1}
                  title={addresses.length <= 1 ? 'El cliente debe tener al menos un domicilio' : 'Eliminar'}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
