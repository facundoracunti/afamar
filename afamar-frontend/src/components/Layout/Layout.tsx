// @ts-nocheck
import { Suspense, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useGet } from "@/shared/api/hooks";
import styles from "./Layout.module.css";

const navGroups = [
  {
    label: "General",
    items: [
      { to: "/admin", label: "Dashboard", end: true },
      { to: "/admin/budgets", label: "Presupuestos" },
      { to: "/admin/work-orders", label: "Órdenes" },
      { to: "/admin/clients", label: "Clientes" },
    ],
  },
  {
    label: "Inventario",
    items: [
      { to: "/admin/materials", label: "Materiales" },
      { to: "/admin/material-consultant", label: "Consultor" },
      { to: "/admin/pool-stock", label: "Piletas" },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { to: "/admin/measurements", label: "Mediciones" },
      { to: "/admin/online-budgets", label: "Online" },
      { to: "/admin/calculator", label: "Calculadora" },
      { to: "/admin/cash", label: "Caja Diaria" },
      { to: "/admin/cash/history", label: "Historial Caja" },
    ],
  },
  {
    label: "Administración",
    items: [
      { to: "/admin/reports", label: "Reportes" },
      { to: "/admin/product-photos", label: "Galería" },
      { to: "/admin/settings", label: "Config" },
    ],
  },
];

// @ts-nocheck
export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const { user, logout } = useAuth();
  const { data: settingsData } = useGet(["settings"], () => api.getSettings());
  const settings = settingsData as { company_logo?: string; company_name?: string } | null;

  const hasLogo = settings?.company_logo && !logoError;

  return (
    <div className={styles.layout}>
      <aside className={`${styles.layout__sidebar} ${collapsed ? styles["layout__sidebar--collapsed"] : ""}`}>
        <div className={styles.layout__header}>
          {collapsed ? (
            <h1 className={styles.layout__logoSmall}>A</h1>
          ) : hasLogo ? (
            <img
              className={styles.layout__logoImg}
              src={settings!.company_logo}
              alt="Logo"
              onError={() => setLogoError(true)}
            />
          ) : (
            <h1 className={styles.layout__logo}>{settings?.company_name || "AFAMAR"}</h1>
          )}
          <button
            type="button"
            className={styles.layout__toggle}
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expandir" : "Colapsar"}
          >
            {collapsed ? ">" : "<"}
          </button>
        </div>

        <nav className={styles.layout__nav}>
          {navGroups.map((group) => (
            <div key={group.label} className={styles.layout__navGroup}>
              {!collapsed && <span className={styles.layout__navGroupLabel}>{group.label}</span>}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `${styles.layout__link} ${isActive ? styles["layout__link--active"] : ""}`
                  }
                >
                  {collapsed ? item.label.slice(0, 2) : item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.layout__footer}>
          {!collapsed && user && (
            <span className={styles.layout__user}>{user.full_name || user.username}</span>
          )}
          <button type="button" className={styles.layout__logout} onClick={logout} title="Cerrar sesión">
            {collapsed ? "X" : "Cerrar sesión"}
          </button>
        </div>
      </aside>
      <main className={styles.layout__content}>
        <Suspense fallback={<LoadingSpinner />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
