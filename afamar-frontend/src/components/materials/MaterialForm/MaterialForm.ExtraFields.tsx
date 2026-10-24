/**
 * `MaterialForm` — capability flag (bacha integrada) + observaciones.
 */
import type { MaterialFormData } from '../../../types/material';
import styles from './MaterialForm.module.css';

const s = styles as unknown as Record<string, string>;

export interface MaterialExtraFieldsProps {
  allows_integrated_sink: MaterialFormData['allows_integrated_sink'];
  notes: MaterialFormData['notes'];
  onChange: (patch: Partial<MaterialFormData>) => void;
}

export function MaterialExtraFields({
  allows_integrated_sink,
  notes,
  onChange,
}: MaterialExtraFieldsProps) {
  return (
    <>
      <div className={s['material-form__group']}>
        <label className={s['material-form__label']}>
          <input
            type="checkbox"
            checked={allows_integrated_sink}
            onChange={(e) => onChange({ allows_integrated_sink: e.target.checked })}
          />{' '}
          Admite bacha integrada
        </label>
        <small className={s['material-form__hint-text']}>
          Desmarcá si este material no se puede cortar con bacha integrada (ej. granitos porosos).
        </small>
      </div>
      <div className={s['material-form__group']}>
        <label className={s['material-form__label']}>Observaciones</label>
        <textarea className="input" rows={3} value={notes} onChange={(e) => onChange({ notes: e.target.value })} />
      </div>
    </>
  );
}
