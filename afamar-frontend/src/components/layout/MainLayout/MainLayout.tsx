import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, SIDEBAR_WIDTH } from './Sidebar';
import { Topbar } from './Topbar';
import styles from './MainLayout.module.css';

const s = styles as unknown as Record<string, string>;

function getPageTitle(pathname: string): string {
  if (pathname === '/admin' || pathname === '/admin/') return 'Panel Principal';
  if (pathname === '/admin/cash/history') return 'Historial de Caja';
  if (pathname === '/admin/materials/categories') return 'Categorías de Materiales';

  const match = (pattern: RegExp, listTitle: string, newTitle: string, editTitle: string): string | null => {
    const m = pathname.match(pattern);
    if (!m) return null;
    if (m[1] === 'new') return newTitle;
    if (/^\d+$/.test(m[1])) return editTitle;
    return listTitle;
  };

  const r = (p: string) => new RegExp(`^/admin/${p}/(new|\\d+)$`);

  const results = [
    match(r('clients'), 'Clientes', 'Nuevo Cliente', 'Editar Cliente'),
    match(r('budgets'), 'Presupuestos', 'Nuevo Presupuesto', 'Editar Presupuesto'),
    match(r('work-orders'), 'Órdenes de Trabajo', 'Nueva Orden de Trabajo', 'Editar Orden de Trabajo'),
    match(r('materials'), 'Materiales', 'Nuevo Material', 'Editar Material'),
    match(r('additional-works'), 'Trabajos Adicionales', 'Nuevo Trabajo Adicional', 'Editar Trabajo Adicional'),
    match(r('measurements'), 'Mediciones', 'Nueva Medición', 'Editar Medición'),
  ];
  for (const r of results) { if (r) return r; }

  const prefixes: Record<string, string> = {
    '/admin/clients': 'Clientes',
    '/admin/budgets': 'Presupuestos',
    '/admin/work-orders': 'Órdenes de Trabajo',
    '/admin/materials': 'Materiales',
    '/admin/pool-stock': 'Stock de Piletas',
    '/admin/additional-works': 'Trabajos Adicionales',
    '/admin/measurements': 'Mediciones',
    '/admin/calculator': 'Calculadora',
    '/admin/cash': 'Caja Diaria',
    '/admin/reports': 'Reportes',
    '/admin/configuration': 'Configuración',
    '/admin/product-photos': 'Fotos de Productos',
  };
  const prefix = Object.keys(prefixes).find(k => pathname === k || pathname.startsWith(k + '/'));
  return prefix ? prefixes[prefix] : 'AFAMAR';
}

export default function MainLayout() {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<string>('');
  const location = useLocation();

  const pageTitle = getPageTitle(location.pathname);
  const sidebarWidth = isCollapsed ? 64 : SIDEBAR_WIDTH;

  return (
    <div className={s['main-layout']}>
      <Sidebar
        isCollapsed={isCollapsed}
        onCollapse={setIsCollapsed}
        expanded={expanded}
        onExpand={setExpanded}
      />
      <div
        className={s['main-layout__content']}
        style={{ marginLeft: sidebarWidth }}
      >
        <Topbar pageTitle={pageTitle} />
        <div className={s['main-layout__page-content']}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
