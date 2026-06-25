import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/DashboardPage';
import ClientesList from './pages/clientes/ClientesListPage';
import ClienteForm from './pages/clientes/ClienteFormPage';
import PresupuestosList from './pages/presupuestos/PresupuestosListPage';
import PresupuestoForm from './pages/presupuestos/PresupuestoFormPage';
import PresupuestosOnlineList from './pages/presupuestos/PresupuestosOnlineListPage';
import PresupuestoOnlineForm from './pages/presupuestos/PresupuestoOnlineFormPage';
import OrdenesList from './pages/ordenes/OrdenesListPage';
import OrdenForm from './pages/ordenes/OrdenFormPage';
import MaterialesList from './pages/materiales/MaterialesListPage';
import MaterialForm from './pages/materiales/MaterialFormPage';
import StockPiletas from './pages/stock/StockPiletasPage';
import Reportes from './pages/reportes/ReportesPage';
import Configuracion from './pages/configuracion/ConfiguracionPage';
import MedicionesList from './pages/mediciones/MedicionesListPage';
import MedicionForm from './pages/mediciones/MedicionFormPage';
import CalculadoraPlaca from './pages/calculadora/CalculadoraPage';
import CajaDiaria from './pages/caja/CajaDiariaPage';
import CajaHistorial from './pages/caja/CajaHistorialPage';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="clientes" element={<ClientesList />} />
          <Route path="clientes/nuevo" element={<ClienteForm />} />
          <Route path="clientes/:id" element={<ClienteForm />} />
          <Route path="presupuestos" element={<PresupuestosList />} />
          <Route path="presupuestos/nuevo" element={<PresupuestoForm />} />
          <Route path="presupuestos/:id" element={<PresupuestoForm />} />
          <Route path="presupuestos-online" element={<PresupuestosOnlineList />} />
          <Route path="presupuestos-online/nuevo" element={<PresupuestoOnlineForm />} />
          <Route path="presupuestos-online/:id" element={<PresupuestoOnlineForm />} />
          <Route path="ordenes" element={<OrdenesList />} />
          <Route path="ordenes/nuevo" element={<OrdenForm />} />
          <Route path="ordenes/:id" element={<OrdenForm />} />
          <Route path="materiales" element={<MaterialesList />} />
          <Route path="materiales/nuevo" element={<MaterialForm />} />
          <Route path="materiales/:id" element={<MaterialForm />} />
          <Route path="stock-piletas" element={<StockPiletas />} />
          <Route path="mediciones" element={<MedicionesList />} />
          <Route path="mediciones/nuevo" element={<MedicionForm />} />
          <Route path="mediciones/:id" element={<MedicionForm />} />
          <Route path="calculadora" element={<CalculadoraPlaca />} />
          <Route path="caja/diaria" element={<CajaDiaria />} />
          <Route path="caja/historial" element={<CajaHistorial />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
