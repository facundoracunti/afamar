import React, { useState } from 'react';
import { getCashHistory } from '@/api/resources/cash';
import { usePaginatedList } from '../../api/hooks';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import { Pagination } from '../../components/ui/Pagination';
import { ArrowUpCircle, ArrowDownCircle, Calendar, FileText, Clock, Hash } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import type { CashHistoryItem, CashMovement } from '../../types/cash';
import styles from './CashHistoryPage.module.css';

const s = styles as unknown as Record<string, string>;

function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds < 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}min`;
  return `${seconds}s`;
}

export default function CashHistoryPage() {
  const { items: cashRecords, loading, total, page, pageSize, setPage } =
    usePaginatedList<CashHistoryItem>(
      ['cash-history'],
      async ({ skip, limit }) => getCashHistory({ skip, limit }),
      { pageSize: 25 },
    );
  const [selected, setSelected] = useState<CashHistoryItem | null>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className={s['cash-history']}>
      <h1 className={s['cash-history__title']}>Historial de Cierres de Caja</h1>

      {cashRecords.length === 0 ? (
        <div className={`card ${s['cash-history__empty']}`}>
          <Calendar size={40} className={s['cash-history__empty-icon']} />
          <p>No hay cajas cerradas aún.</p>
          <p className={s['cash-history__empty-hint']}>Cerrá una caja desde Caja para que aparezca aquí.</p>
        </div>
      ) : (
        <div className={`${s['cash-history__grid']}${selected ? ' ' + s['cash-history__grid--split'] : ''}`}>
          {/* Lista cronológica por número de sesión */}
          <div>
            <div className={`card ${s['cash-history__list-card']}`}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th><Hash size={12} className={s['cash-history__icon-inline']} /> Caja</th>
                      <th>Apertura</th>
                      <th>Cierre</th>
                      <th>Ingresos</th>
                      <th>Salidas</th>
                      <th>Saldo Actual</th>
                      <th>Efectivo Real</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashRecords.map((c: CashHistoryItem) => (
                      <tr key={c.id as number}
                        onClick={() => setSelected((selected?.id as number) === (c.id as number) ? null : c)}
                        className={`${s['cash-history__row']}${(selected?.id as number) === (c.id as number) ? ' ' + s['cash-history__row--selected'] : ''}`}>
                        <td className={s['cash-history__number']}>#{c.number ?? '-'}</td>
                        <td className={s['cash-history__date']}>{formatDateTime(c.opened_at)}</td>
                        <td className={s['cash-history__date']}>{formatDateTime(c.closed_at)}</td>
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
              <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="cierres" />
            </div>
          </div>

          {/* Detalle de la caja seleccionada */}
          {selected && (
            <div>
              <div className={`card ${s['cash-history__detail-card']}`}>
                <h3 className={s['cash-history__detail-title']}>Caja #{selected.number ?? '-'}</h3>
                <div className={s['cash-history__detail-times']}>
                  <span><Clock size={13} className={s['cash-history__icon-inline']} /> Apertura: {formatDateTime(selected.opened_at)}</span>
                  <span>· Cierre: {formatDateTime(selected.closed_at)}</span>
                  <span>· Duración: {formatDuration(selected.summary?.duration_seconds)}</span>
                </div>
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
                    <ArrowUpCircle size={14} className={s['cash-history__icon-inline']} />
                    Ingresos: <CurrencyDisplay value={selected.total_income as number} />
                    <span className={s['cash-history__detail-count']}>
                      ({selected.summary?.ingreso_count ?? 0})
                    </span>
                  </div>
                  <div className={s['cash-history__detail-expense']}>
                    <ArrowDownCircle size={14} className={s['cash-history__icon-inline']} />
                    Egresos: <CurrencyDisplay value={selected.total_expenses as number} />
                    <span className={s['cash-history__detail-count']}>
                      ({selected.summary?.egreso_count ?? 0})
                    </span>
                  </div>
                  <div className={s['cash-history__detail-real-cash']}>
                    Efectivo Real: <CurrencyDisplay value={selected.real_cash as number} />
                  </div>
                </div>

                {selected.summary?.total_by_payment && Object.keys(selected.summary.total_by_payment).length > 0 && (
                  <div className={s['cash-history__by-payment']}>
                    <strong className={s['cash-history__by-payment-title']}>Totales por forma de pago</strong>
                    {Object.entries(selected.summary.total_by_payment).map(([pm, val]) => (
                      <div key={pm} className={s['cash-history__by-payment-row']}>
                        <span>{pm}</span>
                        <CurrencyDisplay value={val as number} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Movimientos de la caja seleccionada */}
              {(selected.movements as CashMovement[] | undefined) && (selected.movements as CashMovement[]).length > 0 && (
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
                        {(selected.movements as CashMovement[]).map((m: CashMovement) => (
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
