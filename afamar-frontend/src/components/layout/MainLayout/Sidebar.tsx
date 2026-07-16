import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, LayoutDashboard, FileText, ClipboardList, Users, Box, Bath, Calendar, Calculator, BarChart3, Settings, Send, Wrench, Clock, Truck, DollarSign, Receipt, History, Image, Tags, type LucideIcon } from 'lucide-react';
import styles from './MainLayout.module.css';

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED = 64;

const s = styles as unknown as Record<string, string>;

const PREFIX = '/admin';

interface AccordionSubItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface AccordionGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  subItems?: AccordionSubItem[] | null;
}

const accordionGroups: AccordionGroup[] = [
  {
    key: 'dashboard',
    label: 'INICIO',
    icon: LayoutDashboard,
    path: `${PREFIX}`,
    subItems: null,
  },
  {
    key: 'budgets',
    label: 'PRESUPUESTOS',
    icon: FileText,
    subItems: [
      { label: 'Presupuesto Local', path: `${PREFIX}/budgets/new`, icon: FileText },
      { label: 'Presupuesto Local / WhatsApp', path: `${PREFIX}/budgets`, icon: FileText },
      { label: 'Presupuestos Realizados', path: `${PREFIX}/budgets?status=CONVERTED_TO_OT`, icon: Clock },
    ],
  },
  {
    key: 'work-orders',
    label: 'ÓRDENES DE TRABAJO',
    icon: ClipboardList,
    subItems: [
      { label: 'Nueva Orden', path: `${PREFIX}/work-orders/new`, icon: Send },
      { label: 'Órdenes Activas', path: `${PREFIX}/work-orders`, icon: ClipboardList },
      { label: 'Terminadas', path: `${PREFIX}/work-orders?status=FINISHED`, icon: Wrench },
      { label: 'Entregado', path: `${PREFIX}/work-orders?status=DELIVERED`, icon: Truck },
    ],
  },
  {
    key: 'inventory',
    label: 'HERRAMIENTAS / STOCK',
    icon: Box,
    subItems: [
      { label: 'Stock de Piletas', path: `${PREFIX}/pool-stock`, icon: Bath },
      { label: 'Materiales', path: `${PREFIX}/materials`, icon: Box },
      { label: 'Trabajos Adicionales', path: `${PREFIX}/additional-works`, icon: Settings },
      { label: 'Categorías', path: `${PREFIX}/materials/categories`, icon: Tags },
      { label: 'Calculadora', path: `${PREFIX}/calculator`, icon: Calculator },
    ],
  },
  {
    key: 'cash',
    label: 'CAJA',
    icon: DollarSign,
    subItems: [
      { label: 'Caja Diaria', path: `${PREFIX}/cash`, icon: Receipt },
      { label: 'Copia de Caja', path: `${PREFIX}/cash/history`, icon: History },
    ],
  },
  {
    key: 'agenda',
    label: 'AGENDA',
    icon: Calendar,
    subItems: [
      { label: 'Clientes', path: `${PREFIX}/clients`, icon: Users },
      { label: 'Mediciones', path: `${PREFIX}/measurements`, icon: Calendar },
    ],
  },
  {
    key: 'reports',
    label: 'REPORTES',
    icon: BarChart3,
    path: `${PREFIX}/reports`,
    subItems: null,
  },
  {
    key: 'config',
    label: 'CONFIGURACIÓN',
    icon: Settings,
    subItems: [
      { label: 'Datos de AFAMAR', path: `${PREFIX}/configuration`, icon: Settings },
      { label: 'Fotos de productos', path: `${PREFIX}/product-photos`, icon: Image },
    ],
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onCollapse: (c: boolean) => void;
  expanded: string;
  onExpand: (s: string) => void;
}

export function Sidebar({ isCollapsed, onCollapse, expanded, onExpand }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const sidebarWidth = isCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH;
  const sidebarClass = `${s['main-layout__sidebar']}${isCollapsed ? ' ' + s['main-layout__sidebar--collapsed'] : ''}`;

  const isGroupActive = (group: AccordionGroup): boolean => {
    if (group.path) return location.pathname === group.path;
    if (group.subItems) return group.subItems.some((sub) => location.pathname.startsWith(sub.path.split('?')[0]));
    return false;
  };

  const toggleExpand = (key: string): void => {
    onExpand(expanded === key ? '' : key);
  };

  const handleNavigate = (path: string): void => {
    navigate(path);
    if (isCollapsed) onExpand('');
  };

  return (
    <aside className={sidebarClass} style={{ width: sidebarWidth }}>
      <div className={s['main-layout__menu-header']}>
        {!isCollapsed && <span>MENÚ</span>}
        <button
          onClick={() => onCollapse(!isCollapsed)}
          className={s['main-layout__collapse-btn']}
          title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          aria-label="Toggle menu"
        >
          {isCollapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      <ul className={s['main-layout__menu-links']}>
        {accordionGroups.map((group) => (
          <li
            key={group.key}
            className={`${s['main-layout__menu-item']}${isGroupActive(group) ? ' ' + s['main-layout__menu-item--active'] : ''}`}
          >
            {group.subItems ? (
              <>
                <button
                  className={s['main-layout__menu-btn']}
                  onClick={() => toggleExpand(group.key)}
                  title={isCollapsed ? group.label : undefined}
                  aria-expanded={!isCollapsed && expanded === group.key}
                >
                  <span className={s['main-layout__menu-btn-icon']}>
                    <group.icon size={18} />
                    {!isCollapsed && group.label}
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      size={14}
                      className={`${s['main-layout__arrow']}${expanded === group.key ? ' ' + s['main-layout__arrow--rotated'] : ''}`}
                    />
                  )}
                </button>
                {!isCollapsed && (
                  <ul
                    className={s['main-layout__submenu']}
                    style={{ maxHeight: expanded === group.key ? (group.subItems.length * 40) + 'px' : 0 }}
                  >
                    {group.subItems.map((sub) => {
                      const subActive = location.pathname.startsWith(sub.path.split('?')[0]) && !location.search;
                      return (
                        <li
                          key={sub.path}
                          className={`${s['main-layout__submenu-item']}${subActive ? ' ' + s['main-layout__submenu-item--active'] : ''}`}
                        >
                          <a
                            href="#!"
                            className={s['main-layout__submenu-link']}
                            onClick={(e) => { e.preventDefault(); handleNavigate(sub.path); }}
                          >
                            <sub.icon size={15} className={s['main-layout__submenu-icon']} />
                            {sub.label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {isCollapsed && expanded === group.key && (
                  <ul className={s['main-layout__submenu-popover']}>
                    <li className={`${s['main-layout__submenu-popover-header']} ${s['main-layout__menu-item--active'] ? '' : ''}`}>
                      <group.icon size={14} />
                      <span>{group.label}</span>
                    </li>
                    {group.subItems.map((sub) => {
                      const subActive = location.pathname.startsWith(sub.path.split('?')[0]) && !location.search;
                      return (
                        <li
                          key={sub.path}
                          className={`${s['main-layout__submenu-item']}${subActive ? ' ' + s['main-layout__submenu-item--active'] : ''}`}
                        >
                          <a
                            href="#!"
                            className={s['main-layout__submenu-link']}
                            onClick={(e) => { e.preventDefault(); handleNavigate(sub.path); }}
                          >
                            <sub.icon size={14} className={s['main-layout__submenu-icon']} />
                            {sub.label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : (
              <button
                className={s['main-layout__menu-btn']}
                onClick={() => handleNavigate(group.path!)}
                title={isCollapsed ? group.label : undefined}
              >
                <span className={s['main-layout__menu-btn-icon']}>
                  <group.icon size={18} />
                  {!isCollapsed && group.label}
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}

export { SIDEBAR_WIDTH };
