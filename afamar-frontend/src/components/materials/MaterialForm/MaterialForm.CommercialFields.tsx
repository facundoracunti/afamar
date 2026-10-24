/**
 * `MaterialForm` — commercial fields (precio M² + moneda, proveedor +
 * stock disponible).
 *
 * The ARS/USD pair is kept in sync by the parent (the conversion factor is
 * the USD rate coming from the settings).
 */
import type { MaterialFormData } from '../../../types/material';
import styles from './MaterialForm.module.css';

const s = styles as unknown as Record<string, string>;

export type MaterialCommercialForm = Pick<
  MaterialFormData,
  'base_price' | 'price_usd' | 'currency' | 'supplier' | 'stock_available'
>;

export interface MaterialCommercialFieldsProps {
  form: MaterialCommercialForm;
  onChange: (patch: Partial<MaterialFormData>) => void;
  onPrecioArsChange: (value: number) => void;
  onPrecioUsdChange: (value: number) => void;
  onMonedaChange: (currency: string) => void;
}

export function MaterialCommercialFields({
  form,
  onChange,
  onPrecioArsChange,
  onPrecioUsdChange,
  onMonedaChange,
}: MaterialCommercialFieldsProps) {
  return (
    <>
      <div className={s['material-form__row']}>
        <div className={`${s['material-form__group']} ${s['material-form__group--grow']}`}>
          <label className={s['material-form__label']}>Precio M²</label>
          <input className="input" type="number" step="0.01" min="0"
            value={form.currency === 'USD' ? (form.price_usd || '') : (form.base_price || '')}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (form.currency === 'USD') onPrecioUsdChange(v);
              else onPrecioArsChange(v);
            }} />
        </div>
        <div className={`${s['material-form__group']} ${s['material-form__group--fixed']}`}>
          <label className={s['material-form__label']}>Moneda</label>
          <select className="input" value={form.currency} onChange={(e) => onMonedaChange(e.target.value)}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>
      <div className={s['material-form__row']}>
        <div className={s['material-form__group']}>
          <label className={s['material-form__label']}>Proveedor</label>
          <input className="input" value={form.supplier} onChange={(e) => onChange({ supplier: e.target.value })} />
        </div>
        <div className={s['material-form__group']}>
          <label className={s['material-form__label']}>Stock disponible</label>
          <input className="input" type="number" min="0" value={form.stock_available} onChange={(e) => onChange({ stock_available: Number(e.target.value) })} />
        </div>
      </div>
    </>
  );
}
