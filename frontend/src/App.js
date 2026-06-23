import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/dashboard/Dashboard';
import ClientesList from './components/clientes/ClientesList';
import ClienteForm from './components/clientes/ClienteForm';
import PresupuestosList from './components/presupuestos/PresupuestosList';
import PresupuestoForm from './components/presupuestos/PresupuestoForm';
import PresupuestosOnlineList from './components/presupuestos/PresupuestosOnlineList';
import PresupuestoOnlineForm from './components/presupuestos/PresupuestoOnlineForm';
import OrdenesList from './components/ordenes/OrdenesList';
import OrdenForm from './components/ordenes/OrdenForm';
import MaterialesList from './components/materiales/MaterialesList';
import MaterialForm from './components/materiales/MaterialForm';
import StockPiletas from './components/stock/StockPiletas';
import Reportes from './components/reportes/Reportes';
import Configuracion from './components/configuracion/Configuracion';
import MedicionesList from './components/mediciones/MedicionesList';
import MedicionForm from './components/mediciones/MedicionForm';
import CalculadoraPlaca from './components/calculadora/CalculadoraPlaca';
import CajaDiaria from './components/caja/CajaDiaria';
import CajaHistorial from './components/caja/CajaHistorial';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
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
