import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getReportsDashboard, getMonthlySales, getMostUsedMaterials } from '@/api/resources/reports';
import { useGet, useList } from '../../api/hooks';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import styles from './ReportsPage.module.css';

const s = styles as unknown as Record<string, string>;

const COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('presupuestos');

  const { data: stats, loading: loadingStats } = useGet<Record<string, unknown>>(
    ['reports-dashboard'],
    async () => (await getReportsDashboard()).data as Record<string, unknown>
  );
  const { data: ventas, loading: loadingVentas } = useGet<Record<string, unknown>>(
    ['reports-monthly-sales'],
    async () => (await getMonthlySales()).data as Record<string, unknown>
  );
  const { items: materiales, loading: loadingMateriales } = useList<Record<string, unknown>>(
    ['reports-most-used-materials'],
    async () => (await getMostUsedMaterials()).data as Record<string, unknown>[]
  );

  const presupuestos = useMemo(() => {
    if (!stats) return null;
    return {
      total: ((stats.pending_budgets as number) || 0) + ((stats.approved_budgets as number) || 0) + ((stats.rejected_budgets as number) || 0),
      pendientes: stats.pending_budgets,
      aprobados: stats.approved_budgets,
      rechazados: stats.rejected_budgets,
      monto_total: 0,
    };
  }, [stats]);

  const ordenes = useMemo(() => {
    if (!stats) return null;
    return {
      total: ((stats.workshop_orders as number) || 0) + ((stats.finished_orders as number) || 0) + ((stats.delivered_orders as number) || 0),
      presupuestadas: stats.workshop_orders,
      en_produccion: stats.finished_orders,
      finalizadas: stats.delivered_orders,
    };
  }, [stats]);

  const loading = loadingStats || loadingVentas || loadingMateriales;
  if (loading) return <LoadingSpinner />;

  const tabs = [
    { key: 'presupuestos', label: 'Presupuestos' },
    { key: 'ordenes', label: 'Órdenes' },
    { key: 'ventas', label: 'Ventas Mensuales' },
    { key: 'materiales', label: 'Materiales' },
  ];

  return (
    <div className={s['reports']}>
      <div className={s['reports__header']}>
        <h1 className={s['reports__title']}>Reportes</h1>
      </div>

      <div className={s['reports__filters']}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'presupuestos' && presupuestos && (
          <div>
            <h3 className="section-title">Resumen de Presupuestos</h3>
            <div className="grid-4">
              <div className="stat-card">
                <div className="value" style={{ color: '#3b82f6' }}>{(presupuestos as Record<string, unknown>).total as number}</div>
                <div className="label">Totales</div>
              </div>
              <div className="stat-card">
                <div className="value" style={{ color: '#f59e0b' }}>{(presupuestos as Record<string, unknown>).pendientes as number}</div>
                <div className="label">Pendientes</div>
              </div>
              <div className="stat-card">
                <div className="value" style={{ color: '#22c55e' }}>{(presupuestos as Record<string, unknown>).aprobados as number}</div>
                <div className="label">Aprobados</div>
              </div>
              <div className="stat-card">
                <div className="value" style={{ color: '#ef4444' }}>{(presupuestos as Record<string, unknown>).rechazados as number}</div>
                <div className="label">Rechazados</div>
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 600 }}>Monto total: ${((presupuestos as Record<string, unknown>).monto_total as number | undefined)?.toFixed(2)}</p>
            </div>
          </div>
        )}

        {activeTab === 'ordenes' && ordenes && (
          <div>
            <h3 className="section-title">Resumen de Órdenes</h3>
            <div className="grid-4">
              <div className="stat-card">
                <div className="value" style={{ color: '#3b82f6' }}>{(ordenes as Record<string, unknown>).total as number}</div>
                <div className="label">Totales</div>
              </div>
              <div className="stat-card">
                <div className="value" style={{ color: '#f59e0b' }}>{(ordenes as Record<string, unknown>).presupuestadas as number}</div>
                <div className="label">Presupuestadas</div>
              </div>
              <div className="stat-card">
                <div className="value" style={{ color: '#8b5cf6' }}>{(ordenes as Record<string, unknown>).en_produccion as number}</div>
                <div className="label">En Producción</div>
              </div>
              <div className="stat-card">
                <div className="value" style={{ color: '#22c55e' }}>{(ordenes as Record<string, unknown>).finalizadas as number}</div>
                <div className="label">Finalizadas</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ventas' && ventas && (
          <div>
            <h3 className="section-title">Ventas Mensuales - {(ventas as Record<string, unknown>).año as number}</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={(ventas as Record<string, unknown>).ventas as Record<string, unknown>[]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tickFormatter={(m) => ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][m-1]} />
                <YAxis />
                <Tooltip formatter={(v: number) => `$${v?.toFixed(2)}`} />
                <Bar dataKey="monto" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'materiales' && (
          <div>
            <h3 className="section-title">Materiales Más Utilizados</h3>
            {materiales.length > 0 ? (
              <div className="grid-2">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={materiales} dataKey="total" nameKey="material" cx="50%" cy="50%" outerRadius={100} label={({ material, total }: { material: string; total: number }) => `${material}: ${total}`}>
                      {materiales.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div>
                  <table>
                    <thead>
                      <tr><th>Material</th><th>Veces utilizado</th></tr>
                    </thead>
                    <tbody>
                      {materiales.map((m, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{(m as Record<string, unknown>).material as string}</td>
                          <td>{(m as Record<string, unknown>).total as number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p style={{ color: '#94a3b8' }}>No hay datos suficientes</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
