// @ts-nocheck
import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import type { EntityFormState } from '../../types';

interface PresupuestoPanelProps {
  form: EntityFormState;
  modoUSD: boolean;
  toggleModoUSD: () => void;
  hayUSD: boolean;
  hayAlternativas: boolean;
  readOnly: boolean;
  saving: boolean;
  handleTrasladoChange: (value: string, source: 'ars' | 'usd') => void;
  handleSenaMonedaChange: (moneda: string) => void;
  handleSenaMontoChange: (value: string) => void;
  handleDolarDiaChange: (value: string) => void;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  update: (field: string, value: unknown) => void;
  num: (v: string) => number | null;
  hidePaymentSection: boolean;
  alternativasTop?: React.ReactNode;
  alternativasGrid?: React.ReactNode;
  descuentoBlock?: React.ReactNode;
  onConfirmarPago?: () => Promise<void>;
  sectionTitle?: string;
  mostrarToggleTitle?: boolean;
  mostrarToggleColumns?: boolean;
}

export default function PresupuestoPanel({
  form, modoUSD, toggleModoUSD, hayUSD, hayAlternativas,
  readOnly, saving, handleTrasladoChange, handleSenaMonedaChange,
  handleSenaMontoChange, handleDolarDiaChange, setForm, update, num,
  hidePaymentSection, alternativasTop, alternativasGrid, descuentoBlock,
  onConfirmarPago, sectionTitle = 'PRESUPUESTO', mostrarToggleTitle = false, mostrarToggleColumns = true,
}: PresupuestoPanelProps) {
  const dd = Number(form.dolar_dia);
  const currencyLabel = modoUSD ? 'USD' : 'ARS';
  const mostrarUSDCol = hayUSD && !modoUSD;
  const matsMain = hayAlternativas ? (form.materiales || []).filter((m: Record<string, unknown>) => !m.es_alternativa) : (form.materiales || []);
  const matsAlt = (form.materiales || []).filter((m: Record<string, unknown>) => m.es_alternativa);

  return (
    <div className="card">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{sectionTitle}</span>
        {mostrarToggleTitle && (
          <button type="button" onClick={toggleModoUSD}
            style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid',
              background: modoUSD ? '#059669' : '#f3f4f6', color: modoUSD ? '#fff' : '#374151', borderColor: modoUSD ? '#059669' : '#d1d5db',
            }}>
            {modoUSD ? 'Mostrar en ARS' : 'Mostrar en USD'}
          </button>
        )}
      </div>

      <div>
        {alternativasTop}

        {!hayAlternativas && mostrarToggleColumns && (
          <div style={{ marginBottom: 8 }}>
            <button type="button" onClick={toggleModoUSD} className="btn btn-sm"
              style={{ background: modoUSD ? '#059669' : '#f3f4f6', color: modoUSD ? '#fff' : '#374151', borderColor: modoUSD ? '#059669' : '#d1d5db', border: '1px solid', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {modoUSD ? 'Mostrar en ARS' : 'Mostrar en USD'}
            </button>
          </div>
        )}

        {!hayAlternativas && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: mostrarUSDCol ? '1 1 280px' : '1 1 100%', fontSize: 13, lineHeight: 1.8 }}>
            <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: '#6b7280' }}>SUBTOTALES ({currencyLabel})</span>
            </div>
            <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 8, marginBottom: 8 }}>
              {(form.detalles_fabricacion || []).filter((d: Record<string, unknown>) => Number(d.precio) > 0).map((d, i) => {
                const dd2 = Number(form.dolar_dia);
                const precioArs = d.moneda === 'ARS' ? Number(d.precio) : (dd2 > 0 ? Number(d.precio) * dd2 : 0);
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{d.concepto === 'OTRA' ? (d.detalle || 'OTRA') : d.concepto}{d.material ? ` - ${d.material}` : ''}{d.m2 > 0 ? ` (${d.m2} m²)` : ''}{(d.largo || 0) > 0 && d.concepto === 'OTRA' ? ` (${d.largo} m)` : ''}{(d.cantidad || 1) > 1 ? ` x${d.cantidad}` : ''}</span>
                    <span style={{ fontWeight: 600 }}>{modoUSD && dd2 > 0 ? `USD ${(precioArs * (d.cantidad || 1) / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(precioArs * (d.cantidad || 1))}</span>
                  </div>
                );
              })}
              {(matsMain || []).map((m: Record<string, unknown>, i) => {
                const dd2 = Number(form.dolar_dia);
                const m2 = Number(m.largo || 0) * Number(m.ancho || 0) * (m.cantidad || 1);
                const sub = m.moneda === 'ARS' ? m2 * (m.precio_m2 || 0) : (dd2 > 0 ? m2 * (m.precio_m2_usd || 0) * dd2 : 0);
                return sub > 0 ? (
                  <div key={'ma' + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{m.nombre} ({m2.toFixed(3)} m²){(m.cantidad || 1) > 1 ? ` x${m.cantidad}` : ''}</span>
                    <span style={{ fontWeight: 600 }}>{modoUSD && dd2 > 0 ? `USD ${(sub / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(sub)}</span>
                  </div>
                ) : null;
              })}
              {(form.piletas || []).map((pt: Record<string, unknown>, i) => {
                const dd2 = Number(form.dolar_dia);
                const precioArs = (pt.moneda || 'ARS') === 'ARS' ? (pt.precio || 0) : (dd2 > 0 ? (pt.precio || 0) * dd2 : 0);
                return (
                  <div key={'pa' + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Pileta {pt.marca} - {pt.modelo}{pt.cantidad > 1 ? ` (x${pt.cantidad})` : ''}</span>
                    <span style={{ fontWeight: 600 }}>{modoUSD && dd2 > 0 ? `USD ${(precioArs * (pt.cantidad || 1) / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(precioArs * (pt.cantidad || 1))}</span>
                  </div>
                );
              })}
            </div>
            <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ margin: 0, fontWeight: 600 }}>{modoUSD ? 'Traslado (USD)' : 'Traslado'}</label>
              <input type="number" className="input" style={{ width: 130, textAlign: 'right' }}
                value={modoUSD && dd > 0 ? (form.traslado / dd).toFixed(2) : form.traslado}
                onChange={(e) => handleTrasladoChange(e.target.value, modoUSD ? 'usd' : 'ars')}
                disabled={readOnly} />
            </div>
            {form.recargo_pct > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 12, color: '#c0392b' }}>
                <span>Recargo financiero ({form.cuotas} cuotas - {form.recargo_pct}%)</span>
                <span style={{ fontWeight: 700 }}>{modoUSD && dd > 0 ? `USD ${(form.recargo_ars / dd).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(form.recargo_ars || 0)}</span>
              </div>
            )}
            <div style={{ borderTop: form.recargo_pct > 0 ? '1px solid #e5e7eb' : '2px solid #e5e7eb', paddingTop: 6, marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>TOTAL {currencyLabel}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: modoUSD ? '#059669' : '#dc2626' }}>{modoUSD && dd > 0 ? `USD ${(form.total / dd).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(form.total)}</span>
              </div>
            </div>
            <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ margin: 0 }}>{modoUSD ? 'Seña recibida (USD)' : 'Seña recibida'}</label>
              <div style={{ display: 'flex', borderRadius: 6, border: '1px solid #d1d5db', overflow: 'hidden', width: 180 }}>
                <select value={form.sena_moneda || 'ARS'} onChange={(e) => handleSenaMonedaChange(e.target.value)} disabled={readOnly}
                  style={{ background: '#f3f4f6', borderRight: '1px solid #d1d5db', padding: '4px 6px', fontSize: 12, fontWeight: 700, border: 'none', outline: 'none' }}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
                <input type="number" className="input" style={{ flex: 1, textAlign: 'right', borderRadius: 0, border: 'none' }}
                  value={form.sena_moneda === 'USD' ? form.sena_usd : form.sena_recibida}
                  onChange={(e) => handleSenaMontoChange(e.target.value)}
                  disabled={readOnly} />
              </div>
            </div>
            {(mostrarUSDCol || modoUSD) && (
              <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <label style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1e40af' }}>DÓLAR DEL DÍA</label>
                <input type="number" className="input" style={{ width: 130, textAlign: 'right', fontWeight: 700, color: '#1e40af', borderColor: '#93c5fd' }}
                  value={form.dolar_dia}
                  onChange={(e) => handleDolarDiaChange(e.target.value)}
                  disabled={readOnly} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontWeight: 600 }}>Saldo pendiente {currencyLabel}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: modoUSD ? '#059669' : '#1e40af' }}>{modoUSD && dd > 0 ? `USD ${(form.saldo_pendiente / dd).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(form.saldo_pendiente)}</span>
            </div>
          </div>

          {mostrarUSDCol && (
            <div style={{ flex: '1 1 280px', fontSize: 13, lineHeight: 1.8 }}>
              <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: '#6b7280' }}>SUBTOTALES (USD)</span>
              </div>
              <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 8, marginBottom: 8 }}>
                {(form.detalles_fabricacion || []).filter((d: Record<string, unknown>) => Number(d.precio) > 0).map((d, i) => {
                  const dd2 = Number(form.dolar_dia);
                  const precioUsd = d.moneda === 'USD' ? Number(d.precio) : (dd2 > 0 ? Number(d.precio) / dd2 : 0);
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{d.concepto === 'OTRA' ? (d.detalle || 'OTRA') : d.concepto}{d.material ? ` - ${d.material}` : ''}{d.m2 > 0 ? ` (${d.m2} m²)` : ''}{(d.cantidad || 1) > 1 ? ` x${d.cantidad}` : ''}</span>
                      <span style={{ fontWeight: 600 }}>USD {(precioUsd * (d.cantidad || 1)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  );
                })}
                {(matsMain || []).map((m: Record<string, unknown>, i) => {
                  const dd2 = Number(form.dolar_dia);
                  const m2 = Number(m.largo || 0) * Number(m.ancho || 0) * (m.cantidad || 1);
                  const sub = m.moneda === 'USD' ? m2 * (m.precio_m2_usd || 0) : (dd2 > 0 ? m2 * (m.precio_m2 || 0) / dd2 : 0);
                  return sub > 0 ? (
                    <div key={'mu' + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{m.nombre} ({m2.toFixed(3)} m²){(m.cantidad || 1) > 1 ? ` x${m.cantidad}` : ''}</span>
                      <span style={{ fontWeight: 600 }}>USD {sub.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ) : null;
                })}
                {(form.piletas || []).map((pt: Record<string, unknown>, i) => {
                  const dd2 = Number(form.dolar_dia);
                  const precioUsd = (pt.moneda || 'ARS') === 'USD' ? (pt.precio || 0) : (dd2 > 0 ? (pt.precio || 0) / dd2 : 0);
                  return (
                    <div key={'pu' + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Pileta {pt.marca} - {pt.modelo}{pt.cantidad > 1 ? ` (x${pt.cantidad})` : ''}</span>
                      <span style={{ fontWeight: 600 }}>USD {(precioUsd * (pt.cantidad || 1)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  );
                })}
              </div>
              <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ margin: 0, fontWeight: 600 }}>Traslado (USD)</label>
                <input type="number" className="input" style={{ width: 130, textAlign: 'right' }}
                  value={form.traslado_usd}
                  onChange={(e) => handleTrasladoChange(e.target.value, 'usd')}
                  disabled={readOnly} />
              </div>
              <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 6, marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>TOTAL USD</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>
                    USD {form.total_usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ margin: 0 }}>Seña recibida (USD)</label>
                <input type="number" className="input" style={{ width: 130, textAlign: 'right' }}
                  value={form.sena_usd}
                  onChange={(e) => handleSenaMontoChange(e.target.value)}
                  disabled={readOnly} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontWeight: 600 }}>Saldo pendiente USD</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>
                  USD {form.saldo_pendiente_usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>
        )}

        {alternativasGrid}
      </div>

      {!hidePaymentSection && (
        <div style={{ marginTop: 12, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <div style={{ marginTop: 12, padding: '10px 14px', background: form.saldo_pagado ? '#d1fae5' : '#fef9c3', borderRadius: 8, border: `1px solid ${form.saldo_pagado ? '#6ee7b7' : '#fde68a'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 13, color: form.saldo_pagado ? '#065f46' : '#92400e' }}>
                  {form.saldo_pagado ? '✓ Saldo cobrado' : '⏳ Saldo pendiente de cobro'}
                </span>
                {form.saldo_pagado && form.fecha_pago_saldo && (
                  <div style={{ fontSize: 11, color: '#065f46', marginTop: 2 }}>Fecha: {form.fecha_pago_saldo}</div>
                )}
              </div>
              <button
                type="button"
                onClick={onConfirmarPago}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  background: form.saldo_pagado ? '#ef4444' : '#059669', color: 'white',
                }}
                disabled={saving}
              >
                {form.saldo_pagado ? 'Deshacer' : '✓ Confirmar pago'}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>TOTAL {currencyLabel}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: modoUSD ? '#059669' : '#dc2626' }}>{modoUSD && dd > 0 ? `USD ${(form.total / dd).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(form.total)}</div>
              </div>
              {mostrarUSDCol && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>TOTAL USD</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#059669' }}>
                    USD {form.total_usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>
          </div>
          {form.recargo_pct > 0 && form.cuotas > 1 && (
            <div style={{ fontSize: 12, color: '#c0392b', fontWeight: 600, marginTop: 8, marginBottom: 8, textAlign: 'center' }}>
              {form.cuotas} cuotas mensuales fijas de {formatCurrency(Math.round((form.total || 0) / (form.cuotas || 1)))}
            </div>
          )}
          {descuentoBlock}
          <div className="form-group" style={{ marginTop: 8 }}>
            <label>Forma de pago</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <select className="input" style={{ flex: 1 }} value={form.forma_pago} onChange={(e) => {
                const newVal = e.target.value;
                update('forma_pago', newVal);
                if (newVal !== 'EFECTIVO') {
                  setForm(prev => ({ ...prev, descuento_porcentaje: 0, descuento_monto_fijo: 0 }));
                }
              }} disabled={readOnly}>
                <option value="">Seleccionar...</option>
                <option value="EFECTIVO">EFECTIVO</option>
                <option value="TRANSFERENCIA BANCARIA">TRANSFERENCIA BANCARIA</option>
                <option value="TARJETA DE DÉBITO">TARJETA DE DÉBITO</option>
                <option value="TARJETA DE CRÉDITO">TARJETA DE CRÉDITO</option>
              </select>
              {form.forma_pago === 'TARJETA DE CRÉDITO' && (
                <select className="input" style={{ width: 160 }} value={form.cuotas || 1} onChange={(e) => update('cuotas', num(e.target.value))} disabled={readOnly}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => {
                    const pct = c <= 2 ? 0 : c * 5;
                    return <option key={c} value={c}>{c} cuota{c > 1 ? 's' : ''} ({pct}%)</option>;
                  })}
                </select>
              )}
            </div>
          </div>
          {form.forma_pago === 'EFECTIVO' && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: '#fffbe6', border: '1px solid #fde68a', borderRadius: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                ­ƒöÆ Descuento Comercial (Solo Vendedor)
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>%</span>
                  <input type="number" className="input" style={{ width: 70, textAlign: 'right' }}
                    placeholder="0" min="0" max="100"
                    value={form.descuento_porcentaje || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setForm({ ...form, descuento_porcentaje: val, descuento_monto_fijo: val > 0 ? 0 : form.descuento_porcentaje });
                    }}
                    disabled={readOnly} />
                </div>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>o</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>$</span>
                  <input type="number" className="input" style={{ width: 100, textAlign: 'right' }}
                    placeholder="Monto fijo"
                    value={form.descuento_monto_fijo || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setForm({ ...form, descuento_monto_fijo: val, descuento_porcentaje: val > 0 ? 0 : form.descuento_porcentaje });
                    }}
                    disabled={readOnly} />
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>
                Este descuento modifica el TOTAL ARS final pero no se muestra en el PDF del cliente.
              </div>
            </div>
          )}
          <div className="form-group" style={{ marginTop: 8 }}>
            <label>Fecha de entrega estimada</label>
            <input type="date" className="input" value={form.fecha_entrega || ''} onChange={(e) => update('fecha_entrega', e.target.value)} disabled={readOnly} />
          </div>
        </div>
      )}
    </div>
  );
}
