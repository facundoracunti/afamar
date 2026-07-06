import React from 'react';
import styles from './DiscountBlock.module.css';

const s = styles as unknown as Record<string, string>;

interface DiscountBlockProps {
  discountPercentage: number;
  discountFixedAmount: number;
  readOnly: boolean;
  onChange: (values: { discount_percentage: number; discount_fixed_amount: number }) => void;
}

export default function DiscountBlock({
  discountPercentage,
  discountFixedAmount,
  readOnly,
  onChange,
}: DiscountBlockProps) {
  return (
    <div className={s['discount-block']}>
      <label className={s['discount-block__label']}>
        ðŸ’° Descuento Comercial (Solo Vendedor)
      </label>
      <div className={s['discount-block__row']}>
        <div className={s['discount-block__group']}>
          <span className={s['discount-block__symbol']}>%</span>
          <input
            type="number"
            className={`input ${s['discount-block__input']} ${s['discount-block__input--pct']}`}
            placeholder="0"
            min="0"
            max="100"
            value={discountPercentage || ''}
            onChange={(e) => {
              const val = Number(e.target.value) || 0;
              onChange({
                discount_percentage: val,
                discount_fixed_amount: val > 0 ? 0 : discountPercentage,
              });
            }}
            disabled={readOnly}
          />
        </div>
        <span className={s['discount-block__sep']}>o</span>
        <div className={s['discount-block__group']}>
          <span className={s['discount-block__symbol']}>$</span>
          <input
            type="number"
            className={`input ${s['discount-block__input']} ${s['discount-block__input--fixed']}`}
            placeholder="Monto fijo"
            value={discountFixedAmount || ''}
            onChange={(e) => {
              const val = Number(e.target.value) || 0;
              onChange({
                discount_fixed_amount: val,
                discount_percentage: val > 0 ? 0 : discountPercentage,
              });
            }}
            disabled={readOnly}
          />
        </div>
      </div>
      <div className={s['discount-block__note']}>
        Este descuento modifica el TOTAL ARS final pero no se muestra en el PDF del cliente.
      </div>
    </div>
  );
}
