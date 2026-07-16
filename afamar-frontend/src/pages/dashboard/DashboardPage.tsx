import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, FileText, ClipboardList, PackageOpen, Truck, Wrench, LayoutGrid, Calculator, type LucideIcon } from 'lucide-react';
import type { DashboardData } from '../../types/dashboard';
import { getDashboard } from '@/api/resources/dashboard';
import { useGet } from '../../api/hooks';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { formatCurrencyValue } from '../../utils/formatters';
import styles from './DashboardPage.module.css';

const s = styles as unknown as Record<string, string>;

type Tone = 'accent' | 'danger' | 'success' | 'warning' | 'info';

interface CardDef {
  icon: LucideIcon;
  label: string;
  value?: string;
  color: string;
  path?: string;
  description: string;
  tone: Tone;
}

export default function Dashboard() {
  const { data, loading, error } = useGet<DashboardData>(
    ['dashboard'],
    async () => (await getDashboard()).data as DashboardData
  );
  const navigate = useNavigate();

  if (loading) return <LoadingSpinner />;
  if (error || !data) return <div className={s['dashboard__error']}>Error al cargar el panel</div>;

  const ing = formatCurrencyValue(data.total_revenue ?? 0);
  const pendiente = formatCurrencyValue(data.total_pending_payments ?? 0);
  const activas = data.total_active_orders ?? 0;
  const terminadas = data.delivered_orders.length;
  const medicion = data.orders_in_measurement ?? 0;
  const taller = data.orders_in_workshop ?? 0;

  const cards: CardDef[] = [
    { icon: DollarSign, label: 'CAJA', value: '$' + ing, color: '#2563eb', tone: 'accent', path: '/admin/cash', description: 'Total de ingresos registrados' },
    { icon: FileText, label: 'NUEVO PRESUPUESTO', color: '#059669', tone: 'success', path: '/admin/budgets/new', description: 'Crear un nuevo presupuesto' },
    { icon: ClipboardList, label: 'NUEVA ORDEN', color: '#dc2626', tone: 'danger', path: '/admin/work-orders/new', description: 'Crear una nueva orden de trabajo' },
    { icon: PackageOpen, label: 'ORDENES EN MEDICION / TALLER', value: String(activas), color: '#d97706', tone: 'warning', path: '/admin/work-orders', description: medicion + ' en medicion - ' + taller + ' en taller' },
    { icon: Truck, label: 'ORDENES TERMINADAS P/ ENVIO', value: String(terminadas), color: '#7c3aed', tone: 'info', path: '/admin/work-orders?estado=DELIVERED', description: 'Listas para retirar' },
    { icon: PackageOpen, label: 'STOCK DE PILETAS', color: '#be185d', tone: 'info', path: '/admin/pool-stock', description: 'Gestionar stock de piletas' },
    { icon: PackageOpen, label: 'MATERIALES', color: '#64748b', tone: 'info', path: '/admin/materials', description: 'Gestionar materiales' },
    { icon: Wrench, label: 'TRABAJOS ADICIONALES', color: '#0891b2', tone: 'info', path: '/admin/additional-works', description: 'Gestionar trabajos adicionales' },
    { icon: LayoutGrid, label: 'CATEGORIAS', color: '#ea580c', tone: 'info', path: '/admin/materials/categories', description: 'Gestionar categorias' },
    { icon: Calculator, label: 'CALCULADORA', color: '#4f46e5', tone: 'info', path: '/admin/calculator', description: 'Calculadora de materiales' },
  ];

  return (
    <div className={s['dashboard']}>
      <header className={s['dashboard__header']}>
        <div>
          <h1 className={s['dashboard__title']}>afamar</h1>
          <p className={s['dashboard__subtitle']}>Panel de control</p>
        </div>
      </header>

      <div className={s['dashboard__grid']}>
        {cards.map((card) => (
          <article
            key={card.label}
            className={s['dashboard__card'] + ' ' + (s['dashboard__card--' + card.tone] || '')}
            onClick={() => card.path && navigate(card.path)}
          >
            <div className={s['dashboard__card-icon']} style={{ backgroundColor: card.color }}>
              <card.icon size={20} color="#fff" />
            </div>
            <span className={s['dashboard__card-label']}>{card.label}</span>
            {card.value && <span className={s['dashboard__card-value']}>{card.value}</span>}
            <span className={s['dashboard__card-desc']}>{card.description}</span>
          </article>
        ))}
      </div>

      <section className={s['dashboard__metrics']}>
        <h2 className={s['dashboard__metrics-title']}>Metricas</h2>
        <div className={s['dashboard__metrics-grid']}>
          <div className={s['dashboard__metric']}>
            <div className={s['dashboard__metric-label']}>Total presupuestos</div>
            <div className={s['dashboard__metric-value']}>{String(data.total_budgets ?? 0)}</div>
          </div>
          <div className={s['dashboard__metric']}>
            <div className={s['dashboard__metric-label']}>Total órdenes</div>
            <div className={s['dashboard__metric-value']}>{String(data.total_orders ?? 0)}</div>
          </div>
          <div className={s['dashboard__metric']}>
            <div className={s['dashboard__metric-label']}>Ingresos</div>
            <div className={s['dashboard__metric-value']}>{'$' + ing}</div>
          </div>
          <div className={s['dashboard__metric']}>
            <div className={s['dashboard__metric-label']}>Pendiente cobro</div>
            <div className={s['dashboard__metric-value']}>{'$' + pendiente}</div>
          </div>
        </div>
      </section>
    </div>
  );
}