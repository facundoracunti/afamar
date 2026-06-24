import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, ChevronDown, LayoutDashboard, FileText, ClipboardList, Users, Box, Bath, Calendar, Calculator, BarChart3, Settings, Globe, Send, Wrench, Clock, Truck, DollarSign, Receipt, History } from 'lucide-react';

const accordionGroups = [
  {
    key: 'dashboard',
    label: 'INICIO',
    icon: LayoutDashboard,
    path: '/',
    subItems: null,
  },
  {
    key: 'presupuestos',
    label: 'PRESUPUESTOS',
    icon: FileText,
    subItems: [
      { label: 'Presupuesto Local', path: '/presupuestos/nuevo', icon: FileText },
      { label: 'Presupuesto en línea', path: '/presupuestos-online/nuevo', icon: Globe },
      { label: 'Presupuesto Local / WhatsApp', path: '/presupuestos', icon: FileText },
      { label: 'Presupuestos Realizados', path: '/presupuestos?estado=CONVERTIDO+A+OT', icon: Clock },
    ],
  },
  {
    key: 'ordenes',
    label: 'ÓRDENES DE TRABAJO',
    icon: ClipboardList,
    subItems: [
      { label: 'Nueva Orden', path: '/ordenes/nuevo', icon: Send },
      { label: 'Ordenes Activas', path: '/ordenes', icon: ClipboardList },
      { label: 'Terminadas', path: '/ordenes?estado=TERMINADA', icon: Wrench },
      { label: 'Entregado', path: '/ordenes?estado=ENTREGADA', icon: Truck },
    ],
  },
  {
    key: 'herramientas',
    label: 'HERRAMIENTAS / STOCK',
    icon: Box,
    subItems: [
      { label: 'Stock de Piletas', path: '/stock-piletas', icon: Bath },
      { label: 'Materiales', path: '/materiales', icon: Box },
      { label: 'Calculadora', path: '/calculadora', icon: Calculator },
    ],
  },
  {
    key: 'caja',
    label: 'CAJA',
    icon: DollarSign,
    subItems: [
      { label: 'Caja Diaria', path: '/caja/diaria', icon: Receipt },
      { label: 'Copia de Caja', path: '/caja/historial', icon: History },
    ],
  },
  {
    key: 'agenda',
    label: 'AGENDA',
    icon: Calendar,
    subItems: [
      { label: 'Clientes', path: '/clientes', icon: Users },
      { label: 'Mediciones', path: '/mediciones', icon: Calendar },
    ],
  },
  {
    key: 'reportes',
    label: 'REPORTES',
    icon: BarChart3,
    path: '/reportes',
    subItems: null,
  },
  {
    key: 'config',
    label: 'CONFIGURACIÓN',
    icon: Settings,
    path: '/configuracion',
    subItems: null,
  },
];

export default function Layout() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(() => localStorage.getItem('sidebarPinned') === 'true');
  const [expanded, setExpanded] = useState('');
  const leaveTimer = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem('sidebarPinned', isPinned);
  }, [isPinned]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isPinned) return;
      if (e.clientX <= 15) {
        if (leaveTimer.current) {
          clearTimeout(leaveTimer.current);
          leaveTimer.current = null;
        }
        setIsOpen(true);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isPinned]);

  const handleMouseLeave = useCallback(() => {
    if (isPinned) return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => {
      setIsOpen(false);
    }, 500);
  }, [isPinned]);

  const handleMouseEnter = useCallback(() => {
    if (isPinned) return;
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setIsOpen(true);
  }, [isPinned]);

  const togglePin = () => setIsPinned((p) => !p);

  const sidebarVisible = isPinned || isOpen;

  const mainShift = sidebarVisible ? 300 : 0;

  const isGroupActive = (group) => {
    if (group.path) return location.pathname === group.path;
    if (group.subItems) return group.subItems.some((s) => location.pathname.startsWith(s.path.split('?')[0]));
    return false;
  };

  const toggleExpand = (key) => {
    setExpanded((prev) => (prev === key ? '' : key));
  };

  const handleNavigate = (path) => {
    navigate(path);
    if (!isPinned) setIsOpen(false);
  };

  return (
    <div>
      <div
        className={`sidebar-trigger${isPinned ? ' hidden' : ''}`}
        onMouseEnter={handleMouseEnter}
      />

      <aside
        className={`sidebar accordion${sidebarVisible ? ' visible' : ''}${isPinned ? ' pinned' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button onClick={togglePin} title={isPinned ? 'Desfijar' : 'Fijar'} className="pin-btn">
          {isPinned ? '📌' : '📍'}
        </button>

        <div className="menu-header">
          <span>MENÚ</span>
          <Menu size={18} />
        </div>

        <ul className="menu-links">
          {accordionGroups.map((group) => (
            <li key={group.key} className={`menu-item${isGroupActive(group) ? ' active' : ''}`}>
              {group.subItems ? (
                <>
                  <button className="menu-btn" onClick={() => toggleExpand(group.key)}>
                    <span><group.icon size={18} className="icon-main" />{group.label}</span>
                    <ChevronDown size={14} className={`arrow${expanded === group.key ? ' rotated' : ''}`} />
                  </button>
                  <ul className="submenu" style={{ maxHeight: expanded === group.key ? (group.subItems.length * 44) + 'px' : 0 }}>
                    {group.subItems.map((sub) => (
                      <li key={sub.path} className={location.pathname.startsWith(sub.path.split('?')[0]) && !location.search ? 'sub-active' : ''}>
                        <a href="#!" onClick={(e) => { e.preventDefault(); handleNavigate(sub.path); }}>
                          <sub.icon size={15} className="sub-icon" />
                          {sub.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <button className="menu-btn" onClick={() => handleNavigate(group.path)}>
                  <span><group.icon size={18} className="icon-main" />{group.label}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </aside>

      <div className="main-content" style={{ marginLeft: mainShift, transition: 'margin-left 0.3s ease-in-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div />
          <div style={{ fontSize: 14, color: '#4a5568' }}>
            {new Date().toLocaleDateString('es-AR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
