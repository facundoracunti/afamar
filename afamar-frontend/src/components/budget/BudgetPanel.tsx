// @ts-nocheck
import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import type { EntityFormState } from '../../types';

interface BudgetPanelProps {
  form: EntityFormState;
  modoUSD: boolean;
  toggleModoUSD: () => void;
  hayUSD: boolean;
  hayAlternativas: boolean;
  readOnly: boolean;
  saving: boolean;
  handleTransportChange: (value: string, source: 'ars' | 'usd') => void;
  handleDepositCurrencyChange: (currency: string) => void;
  handleDepositAmountChange: (value: string) => void;
  handleUsdRateChange: (value: string) => void;
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

export default function BudgetPanel({
  form, modoUSD, toggleModoUSD, hayUSD, hayAlternativas,
  readOnly, saving, handleTransportChange, handleDepositCurrencyChange,
  handleDepositAmountChange, handleUsdRateChange, setForm, update, num,
  hidePaymentSection, alternativasTop, alternativasGrid, descuentoBlock,
  onConfirmarPago, sectionTitle = 'PRESUPUESTO', mostrarToggleTitle = false, mostrarToggleColumns = true,
}: BudgetPanelProps) {
  const dd = Number(form.usd_rate);
  const currencyLabel = modoUSD ? 'USD' : 'ARS';
  const mostrarUSDCol = hayUSD && !modoUSD;
  const matsMain = hayAlternativas ? (form.materials_data || []).filter((m: Record<string, unknown>) => !m.isAlternative) : (form.materials_data || []);
  const matsAlt = (form.materials_data || []).filter((m: Record<string, unknown>) => m.isAlternative);

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
              {(form.fabrication_details || []).filter((d: Record<string, unknown>) => Number(d.precio) > 0).map((d, i) => {
                const dd2 = Number(form.usd_rate);
                const precioArs = d.moneda === 'ARS' ? Number(d.precio) : (dd2 > 0 ? Number(d.precio) * dd2 : 0);
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{d.concepto === 'OTRA' ? (d.detalle || 'OTRA') : d.concepto}{d.material ? ` - ${d.material}` : ''}{d.m2 > 0 ? ` (${d.m2} m²)` : ''}{(d.largo || 0) > 0 && d.concepto === 'OTRA' ? ` (${d.largo} m)` : ''}{(d.cantidad || 1) > 1 ? ` x${d.cantidad}` : ''}</span>
                    <span style={{ fontWeight: 600 }}>{modoUSD && dd2 > 0 ? `USD ${(precioArs * (d.cantidad || 1) / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(precioArs * (d.cantidad || 1))}</span>
                  </div>
                );
              })}
              {(matsMain || []).map((m: Record<string, unknown>, i) => {
                const dd2 = Number(form.usd_rate);
                const m2 = Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1);
                const sub = m.currency === 'ARS' ? m2 * (m.priceM2 || 0) : (dd2 > 0 ? m2 * (m.priceM2Usd || 0) * dd2 : 0);
                return sub > 0 ? (
                  <div key={'ma' + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{m.name} ({m2.toFixed(3)} m²){(m.quantity || 1) > 1 ? ` x${m.quantity}` : ''}</span>
                    <span style={{ fontWeight: 600 }}>{modoUSD && dd2 > 0 ? `USD ${(sub / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(sub)}</span>
                  </div>
                ) : null;
              })}
              {(form.pools_data || []).map((pt: Record<string, unknown>, i) => {
                const dd2 = Number(form.usd_rate);
                const precioArs = (pt.currency || 'ARS') === 'ARS' ? (pt.price || 0) : (dd2 > 0 ? (pt.price || 0) * dd2 : 0);
                return (
                  <div key={'pa' + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Pileta {pt.brand} - {pt.model}{pt.quantity > 1 ? ` (x${pt.quantity})` : ''}</span>
                    <span style={{ fontWeight: 600 }}>{modoUSD && dd2 > 0 ? `USD ${(precioArs * (pt.quantity || 1) / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(precioArs * (pt.quantity || 1))}</span>
                  </div>
                );
              })}
            </div>
            <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ margin: 0, fontWeight: 600 }}>{modoUSD ? 'Traslado (USD)' : 'Traslado'}</label>
              <input type="number" className="input" style={{ width: 130, textAlign: 'right' }}
                value={modoUSD && dd > 0 ? (form.transport / dd).toFixed(2) : form.transport}
                onChange={(e) => handleTransportChange(e.target.value, modoUSD ? 'usd' : 'ars')}
                disabled={readOnly} />
            </div>
            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 6, marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>TOTAL {currencyLabel}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: modoUSD ? '#059669' : '#dc2626' }}>{modoUSD && dd > 0 ? `USD ${(form.total / dd).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(form.total)}</span>
              </div>
            </div>
            <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ margin: 0 }}>{modoUSD ? 'Seña recibida (USD)' : 'Seña recibida'}</label>
              <div style={{ display: 'flex', borderRadius: 6, border: '1px solid #d1d5db', overflow: 'hidden', width: 180 }}>
                <select value={form.deposit_currency || 'ARS'} onChange={(e) => handleDepositCurrencyChange(e.target.value)} disabled={readOnly}
                  style={{ background: '#f3f4f6', borderRight: '1px solid #d1d5db', padding: '4px 6px', fontSize: 12, fontWeight: 700, border: 'none', outline: 'none' }}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
                <input type="number" className="input" style={{ flex: 1, textAlign: 'right', borderRadius: 0, border: 'none' }}
                  value={form.deposit_currency === 'USD' ? form.deposit_usd : form.deposit_received}
                  onChange={(e) => handleDepositAmountChange(e.target.value)}
                  disabled={readOnly} />
              </div>
            </div>
            {(mostrarUSDCol || modoUSD) && (
              <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <label style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1e40af' }}>DÓLAR DEL DÍA</label>
                <input type="number" className="input" style={{ width: 130, textAlign: 'right', fontWeight: 700, color: '#1e40af', borderColor: '#93c5fd' }}
                  value={form.usd_rate}
                  onChange={(e) => handleUsdRateChange(e.target.value)}
                  disabled={readOnly} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontWeight: 600 }}>Saldo pendiente {currencyLabel}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: modoUSD ? '#059669' : '#1e40af' }}>{modoUSD && dd > 0 ? `USD ${(form.balance_due / dd).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(form.balance_due)}</span>
            </div>
          </div>

          {mostrarUSDCol && (
            <div style={{ flex: '1 1 280px', fontSize: 13, lineHeight: 1.8 }}>
              <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: '#6b7280' }}>SUBTOTALES (USD)</span>
              </div>
              <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 8, marginBottom: 8 }}>
                {(form.fabrication_details || []).filter((d: Record<string, unknown>) => Number(d.precio) > 0).map((d, i) => {
                  const dd2 = Number(form.usd_rate);
                  const precioUsd = d.moneda === 'USD' ? Number(d.precio) : (dd2 > 0 ? Number(d.precio) / dd2 : 0);
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{d.concepto === 'OTRA' ? (d.detalle || 'OTRA') : d.concepto}{d.material ? ` - ${d.material}` : ''}{d.m2 > 0 ? ` (${d.m2} m²)` : ''}{(d.cantidad || 1) > 1 ? ` x${d.cantidad}` : ''}</span>
                      <span style={{ fontWeight: 600 }}>USD {(precioUsd * (d.cantidad || 1)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  );
                })}
                {(matsMain || []).map((m: Record<string, unknown>, i) => {
                  const dd2 = Number(form.usd_rate);
                  const m2 = Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1);
                  const sub = m.currency === 'USD' ? m2 * (m.priceM2Usd || 0) : (dd2 > 0 ? m2 * (m.priceM2 || 0) / dd2 : 0);
                  return sub > 0 ? (
                    <div key={'mu' + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{m.name} ({m2.toFixed(3)} m²){(m.quantity || 1) > 1 ? ` x${m.quantity}` : ''}</span>
                      <span style={{ fontWeight: 600 }}>USD {sub.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ) : null;
                })}
                {(form.pools_data || []).map((pt: Record<string, unknown>, i) => {
                  const dd2 = Number(form.usd_rate);
                  const precioUsd = (pt.currency || 'ARS') === 'USD' ? (pt.price || 0) : (dd2 > 0 ? (pt.price || 0) / dd2 : 0);
                  return (
                    <div key={'pu' + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Pileta {pt.brand} - {pt.model}{pt.quantity > 1 ? ` (x${pt.quantity})` : ''}</span>
                      <span style={{ fontWeight: 600 }}>USD {(precioUsd * (pt.quantity || 1)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  );
                })}
              </div>
              <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ margin: 0, fontWeight: 600 }}>Traslado (USD)</label>
                <input type="number" className="input" style={{ width: 130, textAlign: 'right' }}
                  value={form.transport_usd}
                  onChange={(e) => handleTransportChange(e.target.value, 'usd')}
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
                  value={form.deposit_usd}
                  onChange={(e) => handleDepositAmountChange(e.target.value)}
                  disabled={readOnly} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontWeight: 600 }}>Saldo pendiente USD</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>
                  USD {form.balance_due_usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          <div style={{ marginTop: 12, padding: '10px 14px', background: form.balance_paid ? '#d1fae5' : '#fef9c3', borderRadius: 8, border: `1px solid ${form.balance_paid ? '#6ee7b7' : '#fde68a'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 13, color: form.balance_paid ? '#065f46' : '#92400e' }}>
                  {form.balance_paid ? '✓ Saldo cobrado' : '⏳ Saldo pendiente de cobro'}
                </span>
                {form.balance_paid && form.balance_paid_at && (
                  <div style={{ fontSize: 11, color: '#065f46', marginTop: 2 }}>Fecha: {form.balance_paid_at}</div>
                )}
              </div>
              <button
                type="button"
                onClick={onConfirmarPago}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  background: form.balance_paid ? '#ef4444' : '#059669', color: 'white',
                }}
                disabled={saving}
              >
                {form.balance_paid ? 'Deshacer' : '✓ Confirmar pago'}
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
          {descuentoBlock}
          <div className="form-group" style={{ marginTop: 8 }}>
            <label>Forma de pago</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <select className="input" style={{ flex: 1 }} value={form.payment_method} onChange={(e) => {
                const newVal = e.target.value;
                update('payment_method', newVal);
                if (newVal !== 'EFECTIVO') {
                  setForm((prev) => ({ ...prev, discount_percentage: 0, discount_fixed_amount: 0 }));
                }
              }} disabled={readOnly}>
                <option value="">Seleccionar...</option>
                <option value="EFECTIVO">EFECTIVO</option>
                <option value="TRANSFERENCIA BANCARIA">TRANSFERENCIA BANCARIA</option>
                <option value="TARJETA DE DÉBITO">TARJETA DE DÉBITO</option>
                <option value="TARJETA DE CRÉDITO">TARJETA DE CRÉDITO</option>
              </select>
              {form.payment_method === 'TARJETA DE CRÉDITO' && (
                <select className="input" style={{ width: 160 }} value={form.installments || 1} onChange={(e) => update('installments', num(e.target.value) ?? 1)} disabled={readOnly}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => {
                    const pct = c <= 2 ? 0 : c * 5;
                    return <option key={c} value={c}>{c} cuota{c > 1 ? 's' : ''} ({pct}%)</option>;
                  })}
                </select>
              )}
            </div>
          </div>
          {form.payment_method === 'EFECTIVO' && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: '#fffbe6', border: '1px solid #fde68a', borderRadius: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                 Descuento Comercial (Solo Vendedor)
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>%</span>
                  <input type="number" className="input" style={{ width: 70, textAlign: 'right' }}
                    placeholder="0" min="0" max="100"
                    value={form.discount_percentage || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setForm({ ...form, discount_percentage: val, discount_fixed_amount: val > 0 ? 0 : form.discount_percentage });
                    }}
                    disabled={readOnly} />
                </div>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>o</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>$</span>
                  <input type="number" className="input" style={{ width: 100, textAlign: 'right' }}
                    placeholder="Monto fijo"
                    value={form.discount_fixed_amount || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setForm({ ...form, discount_fixed_amount: val, discount_percentage: val > 0 ? 0 : form.discount_percentage });
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
            <input type="date" className="input" value={form.delivery_date || ''} onChange={(e) => update('delivery_date', e.target.value)} disabled={readOnly} />
          </div>
        </div>
      )}
    </div>
  );
}
