/**
 * Fields card of the measurement form (orden de trabajo, estado, agenda,
 * observaciones y fotos).
 *
 * Extracted verbatim from `MeasurementFormPage.tsx`: same styles, same texts,
 * same handlers.
 */
import React from 'react';
import { Save } from 'lucide-react';
import { measurementStatuses } from '../../utils/formatters';
import { t } from '../../utils/translate';
import { MeasurementPhotoGrid } from '../../components/common/MeasurementPhotoGrid';
import type { MeasurementFormData } from '../../types/measurement';
import type { WorkOrderListItem } from '../../types/workOrder';
import styles from './MeasurementFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface MeasurementFormFieldsProps {
  form: MeasurementFormData;
  workOrders: WorkOrderListItem[];
  loadingWorkOrders: boolean;
  saving: boolean;
  isEdit: boolean;
  onChange: (field: keyof MeasurementFormData, value: string) => void;
  onWorkOrderChange: (workOrderId: number | '') => void;
  onAddPhotos: (photos: string[]) => void;
  onRemovePhoto: (index: number) => void;
  onCancel: () => void;
}

export function MeasurementFormFields({
  form,
  workOrders,
  loadingWorkOrders,
  saving,
  isEdit,
  onChange,
  onWorkOrderChange,
  onAddPhotos,
  onRemovePhoto,
  onCancel,
}: MeasurementFormFieldsProps) {
  return (
    <div className={s['measurement-form__card']}>
      <div className={s['measurement-form__row']}>
        <div className={s['measurement-form__group']}>
          <label className={s['measurement-form__label']}>Orden de Trabajo (Medición)</label>
          <select
            className="input"
            value={form.workOrderId ?? ''}
            onChange={(e) => onWorkOrderChange(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={loadingWorkOrders}
          >
            <option value="">— Ninguna —</option>
            {workOrders.map((wo) => (
              <option key={wo.id} value={wo.id}>
                {wo.number}{wo.client_name ? ` — ${wo.client_name}` : ''} ({t(wo.status)})
              </option>
            ))}
          </select>
        </div>
        <div className={s['measurement-form__group']}>
          <label className={s['measurement-form__label']}>Estado</label>
          <select className="input" value={form.status} onChange={(e) => onChange('status', e.target.value)}>
            {measurementStatuses.map((e: string) => <option key={e} value={e}>{t(e)}</option>)}
          </select>
        </div>
      </div>

      <div className={s['measurement-form__row']}>
        <div className={s['measurement-form__group']}>
          <label className={s['measurement-form__label']}>Fecha programada</label>
          <input className="input" type="date" value={form.scheduledDate} onChange={(e) => onChange('scheduledDate', e.target.value)} />
        </div>
        <div className={s['measurement-form__group']}>
          <label className={s['measurement-form__label']}>Hora programada</label>
          <input className="input" type="time" value={form.scheduledTime} onChange={(e) => onChange('scheduledTime', e.target.value)} />
        </div>
      </div>

      <div className={s['measurement-form__group']}>
        <label className={s['measurement-form__label']}>Observaciones</label>
        <textarea className="input" rows={3} value={form.observations} onChange={(e) => onChange('observations', e.target.value)} />
      </div>

      <div className={s['measurement-form__group']}>
        <label className={s['measurement-form__label']}>Fotos</label>
        <MeasurementPhotoGrid
          fotos={form.photos}
          onAddFotos={onAddPhotos}
          onRemoveFoto={onRemovePhoto}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Save size={16} /> {saving ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear Medición')}
        </button>
      </div>
    </div>
  );
}
