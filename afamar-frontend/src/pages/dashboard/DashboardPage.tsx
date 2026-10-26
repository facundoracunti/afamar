import React, { Suspense, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bath,
  Calculator,
  ClipboardList,
  DollarSign,
  FileText,
  LayoutGrid,
  Palette,
  PackageOpen,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DashboardData } from '../../types/dashboard';
import { getDashboard } from '@/api/resources/dashboard';
import { getCurrentCash } from '@/api/resources/cash';
import { getSettings } from '@/api/resources/settings';
import type { CashRegister } from '@/types/cash';
import { useGet } from '../../api/hooks';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { Modal } from '../../components/ui/Modal/Modal';
import { formatCurrencyValue } from '../../utils/formatters';
import heroImage from '@/assets/slider/2.jpg';
import marbleImage from '@/assets/slider/1.jpg';
import graniteImage from '@/assets/slider/3.jpg';
import logo from '@/assets/images/logo-solid-bg-transparente.png';
import styles from './DashboardPage.module.css';

const s = styles as unknown as Record<string, string>;

type ModalKind =
  | 'cash'
  | 'budgets'
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

const CashDailyPage = React.lazy(() => import('../cash/CashDailyPage'));
const BudgetsListPage = React.lazy(() => import('../budgets/BudgetsListPage'));
const BudgetFormPage = React.lazy(() => import('../budgets/BudgetFormPage'));
const WorkOrderFormPage = React.lazy(() => import('../work-orders/WorkOrderFormPage'));
const WorkOrdersListPage = React.lazy(() => import('../work-orders/WorkOrdersListPage'));
const PoolStockPage = React.lazy(() => import('../pool-stock/PoolStockPage'));
const MaterialsListPage = React.lazy(() => import('../materials/MaterialsListPage'));
const AdditionalWorksPage = React.lazy(() => import('../additional-works/AdditionalWorksPage'));
const MaterialsCategoriesPage = React.lazy(() => import('../materials/MaterialsCategoriesPage'));
const MaterialsColorsPage = React.lazy(() => import('../materials/MaterialsColorsPage'));
const CalculatorPage = React.lazy(() => import('../calculator/CalculatorPage'));

interface IndicatorDef {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  tone: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  kind: ModalKind;
}

interface ToolDef {
  icon: LucideIcon;
  label: string;
  description: string;
  kind: ModalKind;
  image: string;
}

interface ActivityItem {
  id: number;
  type: 'budget' | 'order';
  number: string;
  customer: string;
  status: string;
  date: string | null;
  path: string;
}

function formatActivityDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function statusLabel(status: string): string {
  return {
    PENDING: 'Pendiente',
    APPROVED: 'Aprobado',
    MEASUREMENT: 'En medición',
    WORKSHOP: 'En taller',
    FINISHED: 'Listo para enviar',
    DELIVERED: 'Entregado',
  }[status] || status || '—';
}

function statusTone(status: string): string {
  return {
    PENDING: 'pending',
    APPROVED: 'approved',
    MEASUREMENT: 'measurement',
    WORKSHOP: 'workshop',
    FINISHED: 'finished',
    DELIVERED: 'delivered',
  }[status] || 'default';
}

export default function Dashboard() {
  const { data, loading, error } = useGet<DashboardData>(
    ['dashboard'],
    async () => (await getDashboard()).data as DashboardData,
  );
  const { data: cashData } = useGet<CashRegister>(
    ['cash', 'current'],
    async () => (await getCurrentCash()).data as CashRegister,
  );
  const { data: settingsData } = useGet<Record<string, unknown>>(
    ['settings'],
    async () => (await getSettings()).data as Record<string, unknown>,
  );
  const [activeModal, setActiveModal] = useState<ModalKind | null>(null);
  const navigate = useNavigate();

  const activity = useMemo<ActivityItem[]>(() => {
    if (!data) return [];
    const budgets: ActivityItem[] = (data.recent_budgets || []).map((budget) => ({
      id: budget.id,
      type: 'budget',
      number: budget.number,
      customer: budget.customer_name || 'Cliente sin nombre',
      status: budget.status,
      date: budget.created_at,
      path: `/admin/budgets/${budget.id}`,
    }));
    const orders: ActivityItem[] = (data.recent_orders || []).map((order) => ({
      id: order.id,
      type: 'order',
      number: order.number,
      customer: order.customer_name || 'Cliente sin nombre',
      status: order.status,
      date: order.updated_at || order.created_at,
      path: `/admin/work-orders/${order.id}`,
    }));
    return [...budgets, ...orders]
      .sort((a, b) => (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0))
      .slice(0, 8);
  }, [data]);

  if (loading) return <LoadingSpinner />;
  if (error || !data) return <div className={s['dashboard__error']}>Error al cargar el panel</div>;

  const configuredHeroImage = typeof settingsData?.dashboard_image === 'string'
    ? settingsData.dashboard_image.trim()
    : '';
  const dashboardHeroImage = configuredHeroImage || heroImage;

  const indicators: IndicatorDef[] = [
    {
      icon: DollarSign,
      label: 'CAJA (HOY)',
      value: cashData ? formatCurrencyValue(cashData.total_income ?? 0) : '—',
      description: cashData ? 'Ingresos de la caja abierta' : 'Resumen diario no disponible',
      tone: 'blue',
      kind: 'cash',
    },
    {
      icon: FileText,
      label: 'PRESUPUESTOS PENDIENTES',
      value: String(data.pending_budgets ?? 0),
      description: 'Esperando aprobación',
      tone: 'green',
      kind: 'budgets',
    },
    {
      icon: PackageOpen,
      label: 'ÓRDENES EN MEDICIÓN',
      value: String(data.orders_in_measurement ?? 0),
      description: 'Pendientes de medición',
      tone: 'orange',
      kind: 'work-orders',
    },
    {
      icon: Wrench,
      label: 'ÓRDENES EN TALLER',
      value: String(data.orders_in_workshop ?? 0),
      description: 'En proceso de fabricación',
      tone: 'red',
      kind: 'work-orders',
    },
    {
      icon: Truck,
      label: 'LISTAS PARA ENTREGAR',
      value: '—',
      description: 'Dato no disponible en el resumen',
      tone: 'purple',
      kind: 'work-orders-delivered',
    },
  ];

  const tools: ToolDef[] = [
    { icon: PackageOpen, label: 'Materiales', description: 'Gestionar materiales', kind: 'materials', image: marbleImage },
    { icon: Bath, label: 'Stock de piletas', description: 'Gestionar stock', kind: 'pool-stock', image: graniteImage },
    { icon: Wrench, label: 'Trabajos adicionales', description: 'Configurar trabajos', kind: 'additional-works', image: heroImage },
    { icon: LayoutGrid, label: 'Categorías', description: 'Gestionar categorías', kind: 'categories', image: graniteImage },
    { icon: Palette, label: 'Colores', description: 'Gestionar colores', kind: 'colors', image: marbleImage },
    { icon: Calculator, label: 'Calculadora', description: 'Calculadora de materiales', kind: 'calculator', image: heroImage },
  ];

  const closeModal = () => setActiveModal(null);

  return (
    <div className={s['dashboard']}>
      <header className={s['dashboard__hero']}>
        <img className={s['dashboard__hero-image']} src={dashboardHeroImage} alt="" />
        <div className={s['dashboard__hero-shade']} />
        <div className={s['dashboard__hero-copy']}>
          <span className={s['dashboard__hero-kicker']}>PANEL PRINCIPAL</span>
          <h1>Hola, bienvenido</h1>
          <p>Aquí podés gestionar presupuestos, órdenes, materiales y todas las operaciones de AFAMAR.</p>
          <span className={s['dashboard__hero-rule']} />
        </div>
      </header>

      <section className={s['dashboard__actions']} aria-label="Acciones principales">
        <button className={s['dashboard__action'] + ' ' + s['dashboard__action--primary']} onClick={() => setActiveModal('create-budget')}>
          <span className={s['dashboard__action-icon']}><FileText size={25} /></span>
          <span><strong>NUEVO PRESUPUESTO</strong><small>Crear un nuevo presupuesto</small></span>
          <ArrowRight size={21} />
        </button>
        <button className={s['dashboard__action'] + ' ' + s['dashboard__action--secondary']} onClick={() => setActiveModal('create-work-order')}>
          <span className={s['dashboard__action-icon']}><ClipboardList size={25} /></span>
          <span><strong>NUEVA ORDEN DE TRABAJO</strong><small>Crear una nueva orden</small></span>
          <ArrowRight size={21} />
        </button>
      </section>

      <section className={s['dashboard__indicators']} aria-label="Indicadores operativos">
        {indicators.map((indicator) => (
          <button key={indicator.label} className={s['dashboard__indicator'] + ' ' + s[`dashboard__indicator--${indicator.tone}`]} onClick={() => setActiveModal(indicator.kind)}>
            <span className={s['dashboard__indicator-icon']}><indicator.icon size={23} /></span>
            <span className={s['dashboard__indicator-title']}>{indicator.label}</span>
            <strong className={s['dashboard__indicator-value']}>{indicator.value}</strong>
            <span className={s['dashboard__indicator-description']}>{indicator.description}</span>
          </button>
        ))}
      </section>

      <section className={s['dashboard__lower']}>
        <article className={s['dashboard__activity']}>
          <div className={s['dashboard__panel-heading']}>
            <div><span className={s['dashboard__panel-kicker']}>SEGUIMIENTO</span><h2>Actividad reciente</h2></div>
            <button className={s['dashboard__view-all']} onClick={() => setActiveModal('budgets')}>Ver todas <ArrowRight size={16} /></button>
          </div>
          <div className={s['dashboard__activity-table']}>
            <div className={s['dashboard__activity-head']}><span>Tipo</span><span>Número</span><span>Cliente</span><span>Estado</span><span>Fecha</span><span /></div>
            {activity.map((item) => (
              <button key={`${item.type}-${item.id}`} className={s['dashboard__activity-row']} onClick={() => navigate(item.path)}>
                <span className={s['dashboard__activity-type']}><span className={s['dashboard__activity-type-icon']}>{item.type === 'budget' ? <FileText size={15} /> : <ClipboardList size={15} />}</span>{item.type === 'budget' ? 'Presupuesto' : 'Orden'}</span>
                <strong>{item.number || '—'}</strong>
                <span>{item.customer}</span>
                <span><em className={s['dashboard__status'] + ' ' + s[`dashboard__status--${statusTone(item.status)}`]}>{statusLabel(item.status)}</em></span>
                <span>{formatActivityDate(item.date)}</span>
                <ArrowRight size={15} />
              </button>
            ))}
            {!activity.length && <p className={s['dashboard__empty']}>No hay actividad reciente para mostrar.</p>}
          </div>
        </article>

        <article className={s['dashboard__quick-tools']}>
          <div className={s['dashboard__panel-heading']}>
            <div><span className={s['dashboard__panel-kicker']}>OPERACIONES</span><h2>Herramientas rápidas</h2></div>
          </div>
          <div className={s['dashboard__tools-grid']}>
            {tools.map((tool) => (
              <button key={tool.label} className={s['dashboard__tool']} onClick={() => setActiveModal(tool.kind)} style={{ backgroundImage: `url(${tool.image})` }}>
                <span className={s['dashboard__tool-shade']} />
                <span className={s['dashboard__tool-content']}><span className={s['dashboard__tool-icon']}><tool.icon size={21} /></span><strong>{tool.label}</strong><small>{tool.description}</small></span>
                <ArrowRight className={s['dashboard__tool-arrow']} size={17} />
              </button>
            ))}
          </div>
        </article>
      </section>

      <footer className={s['dashboard__institutional-footer']}>
        <div className={s['dashboard__institutional-brand']}>
          <img src={logo} alt="AFAMAR" />
          <strong>AFAMAR</strong>
        </div>
        <span>Av. 72 e/ 23 y 24 N.º 1438</span>
        <span>(221) 457-9935</span>
        <span>WhatsApp 221-411-1348</span>
        <div className={s['dashboard__institutional-slogan']}>
          <i />
          <span>40 años acompañando tus proyectos</span>
        </div>
      </footer>

      <Suspense fallback={<LoadingSpinner />}>
        {DASHBOARD_MODALS.map(({ kind, title, width, render }) => (
          <Modal key={kind} isOpen={activeModal === kind} onClose={closeModal} title={title} width={width}>
            {render(closeModal)}
          </Modal>
        ))}
      </Suspense>
    </div>
  );
}

const DASHBOARD_MODALS: ReadonlyArray<{
  kind: ModalKind;
  title: string;
  width: string;
  render: (close: () => void) => React.ReactNode;
}> = [
  { kind: 'cash', title: 'Caja', width: '1200px', render: () => <CashDailyPage /> },
  { kind: 'budgets', title: 'Presupuestos', width: '1400px', render: () => <BudgetsListPage /> },
  { kind: 'create-budget', title: 'Nuevo Presupuesto', width: '1400px', render: (close) => <BudgetFormPage onSuccess={close} onCancel={close} /> },
  { kind: 'create-work-order', title: 'Nueva Orden de Trabajo', width: '1400px', render: (close) => <WorkOrderFormPage onSuccess={close} onCancel={close} /> },
  { kind: 'work-orders', title: 'Órdenes de Trabajo', width: '1400px', render: () => <WorkOrdersListPage /> },
  { kind: 'work-orders-delivered', title: 'Órdenes terminadas para envío', width: '1400px', render: () => <WorkOrdersListPage initialStatus="DELIVERED" /> },
  { kind: 'pool-stock', title: 'Stock de piletas', width: '1200px', render: () => <PoolStockPage /> },
  { kind: 'materials', title: 'Materiales', width: '1400px', render: () => <MaterialsListPage /> },
  { kind: 'additional-works', title: 'Trabajos adicionales', width: '1200px', render: () => <AdditionalWorksPage /> },
  { kind: 'categories', title: 'Categorías de materiales', width: '1200px', render: () => <MaterialsCategoriesPage /> },
  { kind: 'colors', title: 'Colores de materiales', width: '1200px', render: () => <MaterialsColorsPage /> },
  { kind: 'calculator', title: 'Calculadora', width: '1200px', render: () => <CalculatorPage /> },
];
