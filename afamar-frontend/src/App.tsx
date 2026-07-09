import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import MainLayout from './components/layout/MainLayout/MainLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute/ProtectedRoute';
import DashboardPage from './pages/dashboard/DashboardPage';
import { HomePage } from './pages/home/HomePage';
import LoginPage from './pages/auth/LoginPage';
import ClientsListPage from './pages/clients/ClientsListPage';
import ClientFormPage from './pages/clients/ClientFormPage';
import BudgetsListPage from './pages/budgets/BudgetsListPage';
import BudgetFormPage from './pages/budgets/BudgetFormPage';
import WorkOrdersListPage from './pages/work-orders/WorkOrdersListPage';
import WorkOrderFormPage from './pages/work-orders/WorkOrderFormPage';
import MaterialsListPage from './pages/materials/MaterialsListPage';
import MaterialFormPage from './pages/materials/MaterialFormPage';
import MaterialsCategoriesPage from './pages/materials/MaterialsCategoriesPage';
import PoolStockPage from './pages/pool-stock/PoolStockPage';
import AdditionalWorksPage from './pages/additional-works/AdditionalWorksPage';
import ReportsPage from './pages/reports/ReportsPage';
import ConfigurationPage from './pages/configuration/ConfigurationPage';
import ProductPhotosPage from './pages/product-photos/ProductPhotosPage';
import MeasurementsListPage from './pages/measurements/MeasurementsListPage';
import MeasurementFormPage from './pages/measurements/MeasurementFormPage';
import CalculatorPage from './pages/calculator/CalculatorPage';
import CashDailyPage from './pages/cash/CashDailyPage';
import CashHistoryPage from './pages/cash/CashHistoryPage';

function OldBudgetRedirect() {
  const splat = useParams()['*'];
  return <Navigate to={splat ? `/admin/budgets/${splat}` : '/admin/budgets'} replace />;
}
function OldWorkOrderRedirect() {
  const splat = useParams()['*'];
  return <Navigate to={splat ? `/admin/work-orders/${splat}` : '/admin/work-orders'} replace />;
}
function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
        <AuthProvider>
        <NotificationProvider>
          <Routes>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            {/* Backward-compat redirects from Spanish paths */}
            <Route path="presupuestos/*" element={<OldBudgetRedirect />} />
            <Route path="ordenes/*" element={<OldWorkOrderRedirect />} />
            <Route path="stock-piletas" element={<Navigate to="/admin/pool-stock" replace />} />
            <Route path="caja/diaria" element={<Navigate to="/admin/cash" replace />} />
            <Route path="caja" element={<Navigate to="/admin/cash" replace />} />
            <Route element={<ProtectedRoute />}>
              <Route path="admin" element={<MainLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="clients" element={<ClientsListPage />} />
                <Route path="clients/new" element={<ClientFormPage key="new" />} />
                <Route path="clients/:id" element={<ClientFormPage key="edit" />} />
                <Route path="budgets" element={<BudgetsListPage />} />
                <Route path="budgets/new" element={<BudgetFormPage key="new" />} />
                <Route path="budgets/:id" element={<BudgetFormPage key="edit" />} />
                <Route path="work-orders" element={<WorkOrdersListPage />} />
                <Route path="work-orders/new" element={<WorkOrderFormPage key="new" />} />
                <Route path="work-orders/:id" element={<WorkOrderFormPage key="edit" />} />
                <Route path="materials" element={<MaterialsListPage />} />
                <Route path="materials/categories" element={<MaterialsCategoriesPage />} />
                <Route path="materials/new" element={<MaterialFormPage key="new" />} />
                <Route path="materials/:id" element={<MaterialFormPage key="edit" />} />
                <Route path="pool-stock" element={<PoolStockPage />} />
                <Route path="additional-works" element={<AdditionalWorksPage />} />
                <Route path="measurements" element={<MeasurementsListPage />} />
                <Route path="measurements/new" element={<MeasurementFormPage key="new" />} />
                <Route path="measurements/:id" element={<MeasurementFormPage key="edit" />} />
                <Route path="calculator" element={<CalculatorPage />} />
                <Route path="cash" element={<CashDailyPage />} />
                <Route path="cash/history" element={<CashHistoryPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="configuration" element={<ConfigurationPage />} />
                <Route path="product-photos" element={<ProductPhotosPage />} />
              </Route>
            </Route>
          </Routes>
        </NotificationProvider>
      </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;