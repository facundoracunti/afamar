import React, { useState } from 'react';
import { getCashHistory } from '@/api/resources/cash';
import { useList } from '../../api/hooks';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import { ArrowUpCircle, ArrowDownCircle, Calendar, FileText } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import styles from './CashHistoryPage.module.css';

const s = styles as unknown as Record<string, string>;

export default function CashHistoryPage() {
  const { items: cashRecords, loading } = useList<Record<string, unknown>>(
    ['cash-history'],
    async () => {
      const res = await getCashHistory();
      return (res.data as unknown as Record<string, unknown>[]) || [];
    }
  );
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className={s['cash-history']}>
      <h1 className={s['cash-history__title']}>Historial de Cierres de Caja</h1>

      {cashRecords.length === 0 ? (
        <div className={`card ${s['cash-history__empty']}`}>
          <Calendar size={40} className={s['cash-history__empty-icon']} />
          <p>No hay cajas cerradas aún.</p>
          <p className={s['cash-history__empty-hint']}>Cerrá un día desde Caja Diaria para que aparezca aquí.</p>
        </div>
      ) : (
        <div className={`${s['cash-history__grid']}${selected ? ' ' + s['cash-history__grid--split'] : ''}`}>
          {/* Lista cronológica */}
          <div>
            <div className={`card ${s['cash-history__list-card']}`}>
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
                        className={`${s['cash-history__row']}${(selected?.id as number) === (c.id as number) ? ' ' + s['cash-history__row--selected'] : ''}`}>
                        <td className={s['cash-history__date']}>{c.date as string}</td>
                        <td><CurrencyDisplay value={c.previous_balance as number} /></td>
                        <td className={s['cash-history__income']}><CurrencyDisplay value={c.total_income as number} /></td>
                        <td className={s['cash-history__expense']}><CurrencyDisplay value={c.total_expenses as number} /></td>
                        <td className={s['cash-history__balance']}><CurrencyDisplay value={c.current_balance as number} /></td>
                        <td className={s['cash-history__real-cash']}><CurrencyDisplay value={c.real_cash as number} /></td>
                        <td>
                          <button className={`btn ${s['cash-history__detail-btn']}`}
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
              <div className={`card ${s['cash-history__detail-card']}`}>
                <h3 className={s['cash-history__detail-title']}>Detalle — {selected.date as string}</h3>
                {(selected.notes as string) && (
                  <div className={s['cash-history__notes']}>
                    <strong>Observaciones:</strong> {selected.notes as string}
                  </div>
                )}
                <div className={s['cash-history__detail-grid']}>
                  <div>
                    <span className={s['cash-history__detail-label']}>Saldo Anterior:</span>{' '}
                    <CurrencyDisplay value={selected.previous_balance as number} />
                  </div>
                  <div>
                    <span className={s['cash-history__detail-label']}>Saldo Actual:</span>{' '}
                    <CurrencyDisplay value={selected.current_balance as number} />
                  </div>
                  <div className={s['cash-history__detail-income']}>
                    <ArrowUpCircle size={14} style={{ marginRight: 4 }} />
                    Ingresos: <CurrencyDisplay value={selected.total_income as number} />
                  </div>
                  <div className={s['cash-history__detail-expense']}>
                    <ArrowDownCircle size={14} style={{ marginRight: 4 }} />
                    Egresos: <CurrencyDisplay value={selected.total_expenses as number} />
                  </div>
                  <div className={s['cash-history__detail-real-cash']}>
                    Efectivo Real: <CurrencyDisplay value={selected.real_cash as number} />
                  </div>
                </div>
              </div>

              {/* Movimientos del día seleccionado */}
              {(selected.movements as Record<string, unknown>[]) && (selected.movements as Record<string, unknown>[]).length > 0 && (
                <div className={`card ${s['cash-history__movements-card']}`}>
                  <h3 className={s['cash-history__movements-title']}>Movimientos</h3>
                  <div className={`table-container ${s['cash-history__movements-container']}`}>
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
                            <td className={`${s['cash-history__movement-amount']} ${(m.type as string) === 'INCOME' ? s['cash-history__movement-amount--income'] : s['cash-history__movement-amount--expense']}`}>
                              <CurrencyDisplay value={m.amount as number} />
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
