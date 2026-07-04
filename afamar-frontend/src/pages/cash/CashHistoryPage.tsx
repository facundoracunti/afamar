import React, { useState } from 'react';
import { getCashHistory } from '@/api/resources/cash';
import { useList } from '../../api/hooks';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import { ArrowUpCircle, ArrowDownCircle, Calendar, FileText } from 'lucide-react';
import Loading from '../../components/common/Loading';

export default function CashHistoryPage() {
  const { items: cashRecords, loading } = useList<Record<string, unknown>>(
    ['cash-history'],
    async () => {
      const res = await getCashHistory();
      return (res.data as unknown as Record<string, unknown>[]) || [];
    }
  );
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  if (loading) return <Loading />;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Historial de Cierres de Caja</h1>

      {cashRecords.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <Calendar size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>No hay cajas cerradas aún.</p>
          <p style={{ fontSize: 13 }}>Cerrá un día desde Caja Diaria para que aparezca aquí.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
          {/* Lista cronológica */}
          <div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Saldo Anterior</th>
                      <th>Total Ingresos</th>
                      <th>Total Salidas</th>
                      <th>Saldo Actual</th>
                      <th>Efectivo Real</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashRecords.map((c: Record<string, unknown>) => (
                      <tr key={c.id as number}
                        onClick={() => setSelected((selected?.id as number) === (c.id as number) ? null : c)}
                        style={{ cursor: 'pointer', background: (selected?.id as number) === (c.id as number) ? '#f0fdf4' : undefined }}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.date as string}</td>
                        <td><CurrencyDisplay value={c.previous_balance as number} /></td>
                        <td style={{ color: '#16a34a', fontWeight: 600 }}><CurrencyDisplay value={c.total_income as number} style={{ color: '#16a34a', fontWeight: 600 }} /></td>
                        <td style={{ color: '#dc2626', fontWeight: 600 }}><CurrencyDisplay value={c.total_expenses as number} style={{ color: '#dc2626', fontWeight: 600 }} /></td>
                        <td style={{ fontWeight: 700 }}><CurrencyDisplay value={c.current_balance as number} style={{ fontWeight: 700 }} /></td>
                        <td style={{ fontWeight: 700, color: '#16a34a' }}><CurrencyDisplay value={c.real_cash as number} style={{ fontWeight: 700, color: '#16a34a' }} /></td>
                        <td>
                          <button className="btn" style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer' }}
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelected((selected?.id as number) === (c.id as number) ? null : c); }}>
                            <FileText size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detalle de la caja seleccionada */}
          {selected && (
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Detalle — {selected.date as string}</h3>
                {(selected.notes as string) && (
                  <div style={{ padding: '10px 14px', background: '#fefce8', borderRadius: 8, marginBottom: 12, fontSize: 13, border: '1px solid #fde68a' }}>
                    <strong>Observaciones:</strong> {selected.notes as string}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Saldo Anterior:</span>{' '}
                    <CurrencyDisplay value={selected.previous_balance as number} />
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Saldo Actual:</span>{' '}
                    <CurrencyDisplay value={selected.current_balance as number} />
                  </div>
                  <div style={{ color: '#16a34a' }}>
                    <ArrowUpCircle size={14} style={{ marginRight: 4 }} />
                    Ingresos: <CurrencyDisplay value={selected.total_income as number} style={{ color: '#16a34a' }} />
                  </div>
                  <div style={{ color: '#dc2626' }}>
                    <ArrowDownCircle size={14} style={{ marginRight: 4 }} />
                    Egresos: <CurrencyDisplay value={selected.total_expenses as number} style={{ color: '#dc2626' }} />
                  </div>
                  <div style={{ color: '#16a34a', fontWeight: 700, gridColumn: '1 / -1' }}>
                    Efectivo Real: <CurrencyDisplay value={selected.real_cash as number} style={{ color: '#16a34a', fontWeight: 700 }} />
                  </div>
                </div>
              </div>

              {/* Movimientos del día seleccionado */}
              {(selected.movements as Record<string, unknown>[]) && (selected.movements as Record<string, unknown>[]).length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, padding: '12px 16px 0' }}>Movimientos</h3>
                  <div className="table-container" style={{ marginTop: 8 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Concepto</th>
                          <th>Monto</th>
                          <th>Pago</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.movements as Record<string, unknown>[]).map((m: Record<string, unknown>) => (
                          <tr key={m.id as number}>
                            <td>
                              <span className={`badge ${(m.type as string) === 'INCOME' ? 'badge-approved' : 'badge-rejected'}`}>
                                {(m.type as string) === 'INCOME' ? 'Entrada' : 'Salida'}
                              </span>
                            </td>
                            <td>{(m.description as string) || '-'}</td>
                            <td style={{ fontWeight: 600, color: (m.type as string) === 'INCOME' ? '#16a34a' : '#dc2626' }}>
                              <CurrencyDisplay value={m.amount as number} style={{ fontWeight: 600, color: (m.type as string) === 'INCOME' ? '#16a34a' : '#dc2626' }} />
                            </td>
                            <td>{(m.payment_method as string) || (m.expense_type as string) || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
