import React, { Suspense, useMemo, useState } from 'react';
import { getReportsDashboard, getMonthlySales, getMostUsedMaterials } from '@/api/resources/reports';
import { useGet, useList } from '../../api/hooks';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import styles from './ReportsPage.module.css';

const s = styles as unknown as Record<string, string>;

// Lazy-load the chart components (recharts ≈ 90 KB min / ≈ 30 KB gzip).
// The dynamic import creates a separate chunk that is only fetched when
// the user opens the "Ventas Mensuales" or "Materiales" tabs. Both
// components share the same recharts chunk, so this only downloads once.
const MonthlySalesChart = React.lazy(() =>
  import('./ReportsCharts').then((m) => ({ default: m.MonthlySalesChart }))
);
const MostUsedMaterialsChart = React.lazy(() =>
  import('./ReportsCharts').then((m) => ({ default: m.MostUsedMaterialsChart }))
);

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
  const { items: materials, loading: loadingMateriales } = useList<Record<string, unknown>>(
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
      finalizadas: stats.finished_orders,
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
                <div className={`value ${s['reports__stat-value--blue']}`}>{(presupuestos as Record<string, unknown>).total as number}</div>
                <div className="label">Totales</div>
              </div>
              <div className="stat-card">
                <div className={`value ${s['reports__stat-value--amber']}`}>{(presupuestos as Record<string, unknown>).pendientes as number}</div>
                <div className="label">Pendientes</div>
              </div>
              <div className="stat-card">
                <div className={`value ${s['reports__stat-value--green']}`}>{(presupuestos as Record<string, unknown>).aprobados as number}</div>
                <div className="label">Aprobados</div>
              </div>
              <div className="stat-card">
                <div className={`value ${s['reports__stat-value--red']}`}>{(presupuestos as Record<string, unknown>).rechazados as number}</div>
                <div className="label">Rechazados</div>
              </div>
            </div>
            <div className={s['reports__stat-total']}>
              <p>Monto total: ${((presupuestos as Record<string, unknown>).monto_total as number | undefined)?.toFixed(2)}</p>
            </div>
          </div>
        )}

        {activeTab === 'ordenes' && ordenes && (
          <div>
            <h3 className="section-title">Resumen de Órdenes</h3>
            <div className="grid-4">
              <div className="stat-card">
                <div className={`value ${s['reports__stat-value--blue']}`}>{(ordenes as Record<string, unknown>).total as number}</div>
                <div className="label">Totales</div>
              </div>
              <div className="stat-card">
                <div className={`value ${s['reports__stat-value--amber']}`}>{(ordenes as Record<string, unknown>).presupuestadas as number}</div>
                <div className="label">Presupuestadas</div>
              </div>
              <div className="stat-card">
                <div className={`value ${s['reports__stat-value--purple']}`}>{(ordenes as Record<string, unknown>).en_produccion as number}</div>
                <div className="label">En Producción</div>
              </div>
              <div className="stat-card">
                <div className={`value ${s['reports__stat-value--green']}`}>{(ordenes as Record<string, unknown>).finalizadas as number}</div>
                <div className="label">Finalizadas</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ventas' && ventas && (
          <Suspense fallback={<LoadingSpinner />}>
            <MonthlySalesChart
              data={(ventas as Record<string, unknown>).ventas as Array<Record<string, unknown>>}
              year={(ventas as Record<string, unknown>).año as number}
            />
          </Suspense>
        )}

        {activeTab === 'materiales' && (
          <Suspense fallback={<LoadingSpinner />}>
            <MostUsedMaterialsChart
              materials={materials}
              materialNameClass={s['reports__material-name']}
              emptyMessage={s['reports__empty-data']}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
