import React, { useState } from 'react';
import type { FabricationDetail } from '../../../types/budget';
import PorcelainTileCalculator from '../PorcelainTileCalculator/PorcelainTileCalculator';
import styles from './PorcelainCalculatorSection.module.css';

const s = styles as unknown as Record<string, string>;

interface PorcelainCalculatorSectionProps {
  readOnly: boolean;
  currency: 'ARS' | 'USD';
  onAddDetail: (detail: FabricationDetail) => void;
  toggleLabel?: string;
  addLabel?: string;
  /** Si true, la calculadora arranca abierta (útil cuando vive en su propio paso del wizard). */
  defaultOpen?: boolean;
}

/**
 * Toggle estilo "croquis": un botón que muestra/oculta la calculadora de
 * porcelanato dentro del form de Presupuesto / Orden de Trabajo. Colapsado
 * por defecto, salvo que se pase `defaultOpen` (caso típico: paso dedicado
 * del wizard, donde el primer plano tiene que ser la calculadora). En modo
 * solo-lectura no se renderiza.
 */
export default function PorcelainCalculatorSection({
  readOnly,
  currency,
  onAddDetail,
  toggleLabel = 'Calculadora de Porcelanato',
  addLabel = 'Agregar al presupuesto',
  defaultOpen = false,
}: PorcelainCalculatorSectionProps) {
  const [show, setShow] = useState(defaultOpen);

  if (readOnly) return null;

  return (
    <div className={s['porcelain-calculator-section']}>
      <div className={s['porcelain-calculator-section__header']}>
        <button
          type="button"
          className={`btn btn-outline ${s['porcelain-calculator-section__toggle']}`}
          onClick={() => setShow(!show)}
        >
          {show ? '👁️' : '🧮'} {show ? `Ocultar ${toggleLabel}` : `Activar ${toggleLabel}`}
        </button>
        {!show && <span className={s['porcelain-calculator-section__hint']}>Calculadora oculta.</span>}
      </div>
      {show && (
        <div className={s['porcelain-calculator-section__panel']}>
          <PorcelainTileCalculator currency={currency} onAddDetail={onAddDetail} addLabel={addLabel} />
        </div>
      )}
    </div>
  );
}
