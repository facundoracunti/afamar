import React, { Suspense, useState } from 'react';
import { DollarSign, FileText, ClipboardList, PackageOpen, Truck, Wrench, LayoutGrid, Calculator, Palette, type LucideIcon } from 'lucide-react';
import type { DashboardData } from '../../types/dashboard';
import { getDashboard } from '@/api/resources/dashboard';
import { useGet } from '../../api/hooks';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { Modal } from '../../components/ui/Modal/Modal';
import BudgetForm from '../budgets/BudgetFormPage';
import WorkOrderForm from '../work-orders/WorkOrderFormPage';
import { formatCurrencyValue } from '../../utils/formatters';
import styles from './DashboardPage.module.css';

const s = styles as unknown as Record<string, string>;

type Tone = 'accent' | 'danger' | 'success' | 'warning' | 'info';

/** Each card on the dashboard maps to a `ModalKind` — the dashboard
 *  dispatches on this enum to render the right page in a modal. */
type ModalKind =
  | 'cash'
  | 'create-budget'
  | 'create-work-order'
  | 'work-orders'
  | 'work-orders-delivered'
  | 'pool-stock'
  | 'materials'
  | 'additional-works'
  | 'categories'
  | 'colors'
  | 'calculator';

// Lazy-loaded pages so the dashboard doesn't eagerly pull in all chunks.
// These chunks are shared with the route definitions in App.tsx (also
// `React.lazy`), so opening a modal that lazy-loads the same page won't
// re-download — it just resolves to the cached chunk.
const CashDailyPage = React.lazy(() => import('../cash/CashDailyPage'));
const WorkOrdersListPage = React.lazy(() => import('../work-orders/WorkOrdersListPage'));
const PoolStockPage = React.lazy(() => import('../pool-stock/PoolStockPage'));
const MaterialsListPage = React.lazy(() => import('../materials/MaterialsListPage'));
const AdditionalWorksPage = React.lazy(() => import('../additional-works/AdditionalWorksPage'));
const MaterialsCategoriesPage = React.lazy(() => import('../materials/MaterialsCategoriesPage'));
const MaterialsColorsPage = React.lazy(() => import('../materials/MaterialsColorsPage'));
const CalculatorPage = React.lazy(() => import('../calculator/CalculatorPage'));

interface CardDef {
  icon: LucideIcon;
  label: string;
  value?: string;
  color: string;
  path: string;
  description: string;
  tone: Tone;
  kind: ModalKind;
}

export default function Dashboard() {
  const { data, loading, error } = useGet<DashboardData>(
    ['dashboard'],
    async () => (await getDashboard()).data as DashboardData
  );
  const [activeModal, setActiveModal] = useState<ModalKind | null>(null);

  if (loading) return <LoadingSpinner />;
  if (error || !data) return <div className={s['dashboard__error']}>Error al cargar el panel</div>;

  const ing = formatCurrencyValue(data.total_revenue ?? 0);
  const pendiente = formatCurrencyValue(data.total_pending_payments ?? 0);
  const activas = data.total_active_orders ?? 0;
  const terminadas = data.delivered_orders.length;
  const medicion = data.orders_in_measurement ?? 0;
  const taller = data.orders_in_workshop ?? 0;

  const cards: CardDef[] = [
    { icon: DollarSign, label: 'CAJA', value: '$' + ing, color: '#2563eb', tone: 'accent', kind: 'cash', path: '/admin/cash', description: 'Total de ingresos registrados' },
    { icon: FileText, label: 'NUEVO PRESUPUESTO', color: '#059669', tone: 'success', kind: 'create-budget', path: '/admin/budgets/new', description: 'Crear un nuevo presupuesto' },
    { icon: ClipboardList, label: 'NUEVA ORDEN', color: '#dc2626', tone: 'danger', kind: 'create-work-order', path: '/admin/work-orders/new', description: 'Crear una nueva orden de trabajo' },
    { icon: PackageOpen, label: 'ORDENES EN MEDICION / TALLER', value: String(activas), color: '#d97706', tone: 'warning', kind: 'work-orders', path: '/admin/work-orders', description: medicion + ' en medicion - ' + taller + ' en taller' },
    { icon: Truck, label: 'ORDENES TERMINADAS P/ ENVIO', value: String(terminadas), color: '#7c3aed', tone: 'info', kind: 'work-orders-delivered', path: '/admin/work-orders?estado=DELIVERED', description: 'Listas para retirar' },
    { icon: PackageOpen, label: 'STOCK DE PILETAS', color: '#be185d', tone: 'info', kind: 'pool-stock', path: '/admin/pool-stock', description: 'Gestionar stock de piletas' },
    { icon: PackageOpen, label: 'MATERIALES', color: '#64748b', tone: 'info', kind: 'materials', path: '/admin/materials', description: 'Gestionar materiales' },
    { icon: Wrench, label: 'TRABAJOS ADICIONALES', color: '#0891b2', tone: 'info', kind: 'additional-works', path: '/admin/additional-works', description: 'Gestionar trabajos adicionales' },
    { icon: LayoutGrid, label: 'CATEGORIAS', color: '#ea580c', tone: 'info', kind: 'categories', path: '/admin/materials/categories', description: 'Gestionar categorias' },
    { icon: Palette, label: 'COLORES', color: '#9333ea', tone: 'info', kind: 'colors', path: '/admin/materials/colors', description: 'Gestionar colores de materiales' },
    { icon: Calculator, label: 'CALCULADORA', color: '#4f46e5', tone: 'info', kind: 'calculator', path: '/admin/plate-calculator', description: 'Calculadora de materiales' },
  ];

  const closeModal = () => setActiveModal(null);

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
            onClick={() => setActiveModal(card.kind)}
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

      {/* ── Modals: each renders the actual page inside. The pages own
              their own state, filters, and navigation. When a list page
              wants to drill down (e.g. "Nuevo material"), it calls
              useNavigate which triggers the route change — the dashboard
              unmounts and the new page renders full-width. ─────────── */}

      <Suspense fallback={<LoadingSpinner />}>
        {DASHBOARD_MODALS.map(({ kind, title, width, render }) => (
          <Modal
            key={kind}
            isOpen={activeModal === kind}
            onClose={closeModal}
            title={title}
            width={width}
          >
            {render(closeModal)}
          </Modal>
        ))}
      </Suspense>
    </div>
  );
}

/**
 * Each entry maps a `ModalKind` to the page component that should be
 * rendered inside the modal. Data-driven so adding a new card → modal
 * is a one-line append.
 */
const DASHBOARD_MODALS: ReadonlyArray<{
  kind: ModalKind;
  title: string;
  width: string;
  render: (close: () => void) => React.ReactNode;
}> = [
  { kind: 'cash', title: 'Caja', width: '1200px', render: () => <CashDailyPage /> },
  {
    kind: 'create-budget',
    title: 'Nuevo presupuesto',
    width: '1280px',
     render: (close) => <BudgetForm onSuccess={close} onCancel={close} layoutMode="wizard" />,
  },
  {
    kind: 'create-work-order',
    title: 'Nueva orden de trabajo',
    width: '1280px',
     render: (close) => <WorkOrderForm onSuccess={close} onCancel={close} layoutMode="wizard" />,
  },
  {
    kind: 'work-orders',
    title: 'Órdenes en medición / taller',
    width: '1400px',
    render: () => <WorkOrdersListPage />,
  },
  {
    kind: 'work-orders-delivered',
    title: 'Órdenes terminadas para envío',
    width: '1400px',
    render: () => <WorkOrdersListPage initialStatus="DELIVERED" />,
  },
  { kind: 'pool-stock', title: 'Stock de piletas', width: '1200px', render: () => <PoolStockPage /> },
  { kind: 'materials', title: 'Materiales', width: '1400px', render: () => <MaterialsListPage /> },
  { kind: 'additional-works', title: 'Trabajos adicionales', width: '1200px', render: () => <AdditionalWorksPage /> },
  { kind: 'categories', title: 'Categorías de materiales', width: '1200px', render: () => <MaterialsCategoriesPage /> },
  { kind: 'colors', title: 'Colores de materiales', width: '1200px', render: () => <MaterialsColorsPage /> },
  { kind: 'calculator', title: 'Calculadora', width: '1200px', render: () => <CalculatorPage /> },
];
