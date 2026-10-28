import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bath,
  Calculator,
  Calendar,
  ChevronDown,
  ChevronsLeft,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  History,
  Image,
  LayoutDashboard,
  Menu,
  Palette,
  Receipt,
  Send,
  Settings,
  Tags,
  Truck,
  Users,
  Wrench,
  X,
  Box,
  type LucideIcon,
} from 'lucide-react';
import styles from './MainLayout.module.css';
import logo from '@/assets/images/logo-solid-bg-transparente.png';

const SIDEBAR_WIDTH = 250;
const SIDEBAR_COLLAPSED = 64;
const PREFIX = '/admin';
const s = styles as unknown as Record<string, string>;

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
  { key: 'dashboard', label: 'Panel Principal', icon: LayoutDashboard, path: PREFIX, subItems: null },
  {
    key: 'budgets', label: 'Presupuestos', icon: FileText, subItems: [
      { label: 'Nuevo Presupuesto', path: `${PREFIX}/budgets/new`, icon: FileText },
      { label: 'Presupuestos Generados', path: `${PREFIX}/budgets`, icon: FileText },
      { label: 'Presupuestos Concretados', path: `${PREFIX}/budgets?status=CONVERTED_TO_OT`, icon: Clock },
    ],
  },
  {
    key: 'work-orders', label: 'Órdenes de trabajo', icon: ClipboardList, subItems: [
      { label: 'Nueva Orden', path: `${PREFIX}/work-orders/new`, icon: Send },
      { label: 'Órdenes Activas', path: `${PREFIX}/work-orders`, icon: ClipboardList },
      { label: 'Terminadas', path: `${PREFIX}/work-orders?status=FINISHED`, icon: Wrench },
      { label: 'Entregado', path: `${PREFIX}/work-orders?status=DELIVERED`, icon: Truck },
    ],
  },
  {
    key: 'cash', label: 'Caja', icon: DollarSign, subItems: [
      { label: 'Caja', path: `${PREFIX}/cash`, icon: Receipt },
      { label: 'Copia de Caja', path: `${PREFIX}/cash/history`, icon: History },
    ],
  },
  { key: 'pool-stock', label: 'Stock de piletas', icon: Bath, path: `${PREFIX}/pool-stock`, subItems: null },
  { key: 'materials', label: 'Materiales', icon: Box, path: `${PREFIX}/materials`, subItems: null },
  { key: 'clients', label: 'Clientes', icon: Users, path: `${PREFIX}/clients`, subItems: null },
  {
    key: 'agenda', label: 'Agenda', icon: Calendar, subItems: [
      { label: 'Mediciones', path: `${PREFIX}/measurements`, icon: Calendar },
    ],
  },
  { key: 'additional-works', label: 'Trabajos adicionales', icon: Wrench, path: `${PREFIX}/additional-works`, subItems: null },
  { key: 'categories', label: 'Categorías', icon: Tags, path: `${PREFIX}/materials/categories`, subItems: null },
  { key: 'colors', label: 'Colores', icon: Palette, path: `${PREFIX}/materials/colors`, subItems: null },
  {
    key: 'calculators', label: 'Calculadoras', icon: Calculator, subItems: [
      { label: 'Calculadora de Placa', path: `${PREFIX}/plate-calculator`, icon: Calculator },
      { label: 'Calculadora de Porcelanato', path: `${PREFIX}/porcelain-tile-calculator`, icon: Calculator },
    ],
  },
  { key: 'reports', label: 'Reportes', icon: BarChart3, path: `${PREFIX}/reports`, subItems: null },
  {
    key: 'config', label: 'Configuración', icon: Settings, subItems: [
      { label: 'Datos de AFAMAR', path: `${PREFIX}/configuration`, icon: Settings },
      { label: 'Métodos de Pago', path: `${PREFIX}/configuration/payment-methods`, icon: DollarSign },
      { label: 'Fotos de productos', path: `${PREFIX}/product-photos`, icon: Image },
    ],
  },
];

const navigationSections: Array<{ label: string; keys: string[] }> = [
  { label: 'INICIO', keys: ['dashboard'] },
  { label: 'OPERACIONES', keys: ['budgets', 'work-orders', 'clients', 'agenda'] },
  { label: 'ADMINISTRACIÓN', keys: ['cash', 'pool-stock', 'materials'] },
  { label: 'HERRAMIENTAS', keys: ['additional-works', 'categories', 'colors', 'calculators'] },
  { label: 'REPORTES', keys: ['reports'] },
  { label: 'CONFIGURACIÓN', keys: ['config'] },
];

interface SidebarProps {
  isCollapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  expanded: string;
  onExpand: (key: string) => void;
  isMobile?: boolean;
  isMobileOpen?: boolean;
  onMobileToggle?: () => void;
  onMobileClose?: () => void;
}

export function Sidebar({ isCollapsed, onCollapse, expanded, onExpand, isMobile = false, isMobileOpen = false, onMobileToggle, onMobileClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const groupByKey = new Map(accordionGroups.map((group) => [group.key, group]));
  const sidebarWidth = isMobile ? SIDEBAR_WIDTH : isCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH;
  const visuallyCollapsed = isCollapsed && !isMobile;
  const sidebarClass = [
    s['main-layout__sidebar'],
    visuallyCollapsed ? s['main-layout__sidebar--collapsed'] : '',
    isMobile ? s['main-layout__sidebar--mobile'] : '',
    isMobile && isMobileOpen ? s['main-layout__sidebar--mobile-open'] : '',
  ].filter(Boolean).join(' ');

  const isGroupActive = (group: AccordionGroup): boolean => {
    if (group.path) return location.pathname === group.path;
    return group.subItems?.some((sub) => location.pathname.startsWith(sub.path.split('?')[0])) ?? false;
  };

  const handleNavigate = (path: string): void => {
    navigate(path);
    if (isMobile) onMobileClose?.();
    else if (isCollapsed) onExpand('');
  };

  const renderGroup = (group: AccordionGroup) => {
    const active = isGroupActive(group);
    const isExpanded = !visuallyCollapsed && expanded === group.key;
    return (
      <li key={group.key} className={`${s['main-layout__menu-item']}${active ? ' ' + s['main-layout__menu-item--active'] : ''}`}>
        {group.subItems ? (
          <>
            <button
              className={s['main-layout__menu-btn']}
              onClick={() => onExpand(expanded === group.key ? '' : group.key)}
              title={visuallyCollapsed ? group.label : undefined}
              aria-expanded={isExpanded}
            >
              <span className={s['main-layout__menu-btn-icon']}>
                <group.icon size={18} />
                {!visuallyCollapsed && <span>{group.label}</span>}
              </span>
              {!visuallyCollapsed && <ChevronDown size={14} className={`${s['main-layout__arrow']}${isExpanded ? ' ' + s['main-layout__arrow--rotated'] : ''}`} />}
            </button>
            {!visuallyCollapsed && (
              <ul className={s['main-layout__submenu']} style={{ maxHeight: isExpanded ? `${group.subItems.length * 40}px` : 0 }}>
                {group.subItems.map((sub) => {
                  const [subPath, subQuery] = sub.path.split('?');
                  const subActive = location.pathname === subPath && (!subQuery || location.search === `?${subQuery}`);
                  return <li key={sub.path} className={`${s['main-layout__submenu-item']}${subActive ? ' ' + s['main-layout__submenu-item--active'] : ''}`}>
                    <a href="#!" className={s['main-layout__submenu-link']} onClick={(event) => { event.preventDefault(); handleNavigate(sub.path); }}>
                      <sub.icon size={15} className={s['main-layout__submenu-icon']} />{sub.label}
                    </a>
                  </li>;
                })}
              </ul>
            )}
            {visuallyCollapsed && expanded === group.key && (
              <ul className={s['main-layout__submenu-popover']}>
                <li className={s['main-layout__submenu-popover-header']}><group.icon size={14} /><span>{group.label}</span></li>
                {group.subItems.map((sub) => <li key={sub.path} className={s['main-layout__submenu-item']}>
                  <a href="#!" className={s['main-layout__submenu-link']} onClick={(event) => { event.preventDefault(); handleNavigate(sub.path); }}>
                    <sub.icon size={14} className={s['main-layout__submenu-icon']} />{sub.label}
                  </a>
                </li>)}
              </ul>
            )}
          </>
        ) : (
          <button className={s['main-layout__menu-btn']} onClick={() => handleNavigate(group.path!)} title={visuallyCollapsed ? group.label : undefined}>
            <span className={s['main-layout__menu-btn-icon']}><group.icon size={18} />{!visuallyCollapsed && <span>{group.label}</span>}</span>
          </button>
        )}
      </li>
    );
  };

  return (
    <aside className={sidebarClass} style={isMobile ? undefined : { width: sidebarWidth }}>
      <div className={s['main-layout__menu-header']}>
        <div className={s['main-layout__brand']}>
          <img src={logo} alt="AFAMAR" />
          <div className={s['main-layout__brand-copy']}>
            <strong>AFAMAR</strong>
            <span>Mármoles y Granitos</span>
            <small>Desde 1923</small>
          </div>
        </div>
        <button
          onClick={() => isMobile ? onMobileToggle?.() : onCollapse(!isCollapsed)}
          className={s['main-layout__collapse-btn']}
          title={isMobile ? (isMobileOpen ? 'Cerrar menú' : 'Abrir menú') : isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          aria-label={isMobile ? (isMobileOpen ? 'Cerrar menú' : 'Abrir menú') : isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {isMobile ? <X size={19} /> : isCollapsed ? <Menu size={19} /> : <X size={19} />}
        </button>
      </div>
      <nav className={s['main-layout__menu-links']} aria-label="Navegación principal">
        {navigationSections.map((section) => (
          <div key={section.label} className={s['main-layout__menu-section']}>
            {!visuallyCollapsed && <div className={s['main-layout__menu-section-label']}>{section.label}</div>}
            <ul className={s['main-layout__menu-section-items']}>
              {section.keys.map((key) => {
                const group = groupByKey.get(key);
                return group ? renderGroup(group) : null;
              })}
            </ul>
          </div>
        ))}
      </nav>
      <footer className={s['main-layout__sidebar-footer']}>
        <button type="button" onClick={() => onCollapse(true)} className={s['main-layout__hide-menu']}>
          <ChevronsLeft size={16} />
          <span>Ocultar menú</span>
        </button>
      </footer>
    </aside>
  );
}

export { SIDEBAR_WIDTH };
