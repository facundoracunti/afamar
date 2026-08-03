import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import type { FabricationDetail } from '../../../types/budget';
import { formatCurrencyValue } from '../../../utils/formatters';
import {
  buildPorcelainFabricationDetail,
  calculatePorcelainCut,
  type PorcelainCutInput,
} from '../../../utils/porcelainCalculator';
import styles from './PorcelainTileCalculator.module.css';

const s = styles as unknown as Record<string, string>;

interface PorcelainTileCalculatorProps {
  /** Moneda del ítem de corte (sigue el modo del form). */
  currency: 'ARS' | 'USD';
  /** Si se provee, muestra el botón "Agregar" que entrega el ítem de fabricación. */
  onAddDetail?: (detail: FabricationDetail) => void;
  /** Label del botón de agregado (por defecto "Agregar al presupuesto"). */
  addLabel?: string;
}

interface PorcelainCalculation {
  input: PorcelainCutInput;
  ml: number;
  total: number;
  placas: number;
  cortesPorPlaca: number;
  cortesTotal: number;
  alturaFinalM: number;
}

interface FieldState {
  largo: string;
  ancho: string;
  cajas: string;
  piezasPorCaja: string;
  altura: string;
  disco: string;
  precioPorMl: string;
}

const INITIAL_FIELDS: FieldState = {
  largo: '',
  ancho: '',
  cajas: '',
  piezasPorCaja: '',
  altura: '',
  disco: '3',
  precioPorMl: '',
};

export default function PorcelainTileCalculator({
  currency,
  onAddDetail,
  addLabel = 'Agregar al presupuesto',
}: PorcelainTileCalculatorProps) {
  const [fields, setFields] = useState<FieldState>(INITIAL_FIELDS);
  const [calculation, setCalculation] = useState<PorcelainCalculation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const handleChange = (field: keyof FieldState, value: string) => {
    setFields((prev) => ({ ...prev, [field]: value }));
    setAdded(false);
  };

  const calcular = () => {
    const largo = Number(fields.largo);
    const ancho = Number(fields.ancho);
    const cajas = Number(fields.cajas);
    const piezasPorCaja = Number(fields.piezasPorCaja);
    const altura = Number(fields.altura);
    const precioPorMl = Number(fields.precioPorMl);
    const disco = Number(fields.disco) || 0;
    const invalid =
      !(largo > 0 && ancho > 0 && cajas > 0 && piezasPorCaja > 0 && altura > 0 && precioPorMl >= 0);
    if (invalid) {
      setError('Completá largo, ancho, cajas, piezas por caja, altura y precio por ML.');
      setCalculation(null);
      setAdded(false);
      return;
    }
    const input: PorcelainCutInput = {
      largoM: largo,
      anchoM: ancho,
      cajas,
      piezasPorCaja,
      alturaM: altura,
      discoMm: disco,
      precioPorMl,
    };
    const r = calculatePorcelainCut(input);
    setError(null);
    setCalculation({
      input,
      placas: r.placas,
      cortesPorPlaca: r.cortesPorPlaca,
      cortesTotal: r.cortesTotal,
      ml: r.ml,
      total: r.total,
      alturaFinalM: r.alturaFinalM,
    });
    setAdded(false);
  };

  const handleAdd = () => {
    if (!calculation || !onAddDetail) return;
    onAddDetail(buildPorcelainFabricationDetail(calculation.input, currency));
    setAdded(true);
  };

  return (
    <div className={s['ptc']}>
      <div className={s['ptc__formGrid']}>
        <div className={`form-group ${s['ptc__field']}`}>
          <label htmlFor="ptc-largo">Largo porcelanato (m)</label>
          <input
            id="ptc-largo"
            className="input"
            type="number"
            step="0.01"
            min="0"
            placeholder="1.20"
            value={fields.largo}
            onChange={(e) => handleChange('largo', e.target.value)}
          />
        </div>
        <div className={`form-group ${s['ptc__field']}`}>
          <label htmlFor="ptc-ancho">Ancho porcelanato (m)</label>
          <input
            id="ptc-ancho"
            className="input"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.60"
            value={fields.ancho}
            onChange={(e) => handleChange('ancho', e.target.value)}
          />
        </div>
        <div className={`form-group ${s['ptc__field']}`}>
          <label htmlFor="ptc-cajas">Cantidad de cajas</label>
          <input
            id="ptc-cajas"
            className="input"
            type="number"
            min="0"
            step="1"
            placeholder="1"
            value={fields.cajas}
            onChange={(e) => handleChange('cajas', e.target.value)}
          />
        </div>
        <div className={`form-group ${s['ptc__field']}`}>
          <label htmlFor="ptc-piezas">Piezas por caja</label>
          <input
            id="ptc-piezas"
            className="input"
            type="number"
            min="0"
            step="1"
            placeholder="4"
            value={fields.piezasPorCaja}
            onChange={(e) => handleChange('piezasPorCaja', e.target.value)}
          />
        </div>
        <div className={`form-group ${s['ptc__field']}`}>
          <label htmlFor="ptc-altura">Altura solicitada zócalo (m)</label>
          <input
            id="ptc-altura"
            className="input"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.10"
            value={fields.altura}
            onChange={(e) => handleChange('altura', e.target.value)}
          />
        </div>
        <div className={`form-group ${s['ptc__field']}`}>
          <label htmlFor="ptc-disco">Espesor disco (mm)</label>
          <input
            id="ptc-disco"
            className="input"
            type="number"
            step="1"
            min="0"
            placeholder="3"
            value={fields.disco}
            onChange={(e) => handleChange('disco', e.target.value)}
          />
        </div>
        <div className={`form-group ${s['ptc__field']}`}>
          <label htmlFor="ptc-precio-ml">Precio por ML ({currency === 'USD' ? 'US$' : '$'})</label>
          <input
            id="ptc-precio-ml"
            className="input"
            type="number"
            step="0.01"
            min="0"
            placeholder="5000"
            value={fields.precioPorMl}
            onChange={(e) => handleChange('precioPorMl', e.target.value)}
          />
        </div>
        <div className={`form-group ${s['ptc__field']} ${s['ptc__field--action']}`}>
          <label>&nbsp;</label>
          <button type="button" className={`btn btn-primary ${s['ptc__calcBtn']}`} onClick={calcular}>
            <Calculator size={16} /> CALCULAR
          </button>
        </div>
      </div>

      {error && <p className={s['ptc__error']}>{error}</p>}

      {calculation && (
        <div className={s['ptc__results']}>
          <p className={s['ptc__note']}>
            Altura final aproximada del zócalo: {(calculation.alturaFinalM * 100).toFixed(1)} cm
            {' '}(solicitada {Math.round(calculation.input.alturaM * 100)} cm −{' '}
            {calculation.input.discoMm} mm de disco). Solo informativo — no modifica los ML.
          </p>
          <div className={s['ptc__statGrid']}>
            <div className={s['ptc__statCard']}>
              <div className={s['ptc__statLabel']}>Placas</div>
              <div className={s['ptc__statValue']}>{calculation.placas}</div>
            </div>
            <div className={`${s['ptc__statCard']} ${s['ptc__statCard--info']}`}>
              <div className={s['ptc__statLabel']}>Cortes por placa</div>
              <div className={`${s['ptc__statValue']} ${s['ptc__statValue--info']}`}>
                {calculation.cortesPorPlaca}
              </div>
            </div>
            <div className={`${s['ptc__statCard']} ${s['ptc__statCard']}`}>
              <div className={s['ptc__statLabel']}>Cortes totales</div>
              <div className={s['ptc__statValue']}>{calculation.cortesTotal}</div>
            </div>
            <div className={`${s['ptc__statCard']} ${s['ptc__statCard']}`}>
              <div className={s['ptc__statLabel']}>Producción (ML)</div>
              <div className={s['ptc__statValue']}>{calculation.ml.toFixed(2)}</div>
            </div>
            <div className={`${s['ptc__statCard']} ${s['ptc__statCard']}`}>
              <div className={s['ptc__statLabel']}>Precio por ML</div>
              <div className={s['ptc__statValue']}>
                {formatCurrencyValue(calculation.input.precioPorMl, { currency, decimals: 0 })}
              </div>
            </div>
            <div className={`${s['ptc__statCard']} ${s['ptc__statCard--success']}`}>
              <div className={s['ptc__statLabel']}>TOTAL</div>
              <div className={`${s['ptc__statValue']} ${s['ptc__statValue--success']}`}>
                {formatCurrencyValue(calculation.total, { currency })}
              </div>
            </div>
          </div>

          {onAddDetail && (
            <div className={s['ptc__addWrap']}>
              <button type="button" className={`btn btn-primary ${s['ptc__addBtn']}`} onClick={handleAdd}>
                <Calculator size={16} /> {addLabel}
              </button>
              {added && <span className={s['ptc__added']}>✓ Ítem agregado</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
