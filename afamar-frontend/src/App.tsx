import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import MainLayout from './components/layout/MainLayout/MainLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute/ProtectedRoute';
import { LoadingSpinner } from './components/ui/LoadingSpinner/LoadingSpinner';
import { HomePage } from './pages/home/HomePage';
import LoginPage from './pages/auth/LoginPage';

const DashboardPage = React.lazy(() => import('./pages/dashboard/DashboardPage'));
const ClientsListPage = React.lazy(() => import('./pages/clients/ClientsListPage'));
const ClientFormPage = React.lazy(() => import('./pages/clients/ClientFormPage'));
const BudgetsListPage = React.lazy(() => import('./pages/budgets/BudgetsListPage'));
const BudgetFormPage = React.lazy(() => import('./pages/budgets/BudgetFormPage'));
const WorkOrdersListPage = React.lazy(() => import('./pages/work-orders/WorkOrdersListPage'));
const WorkOrderFormPage = React.lazy(() => import('./pages/work-orders/WorkOrderFormPage'));
const MaterialsListPage = React.lazy(() => import('./pages/materials/MaterialsListPage'));
const MaterialFormPage = React.lazy(() => import('./pages/materials/MaterialFormPage'));
const MaterialsCategoriesPage = React.lazy(() => import('./pages/materials/MaterialsCategoriesPage'));
const PoolStockPage = React.lazy(() => import('./pages/pool-stock/PoolStockPage'));
const AdditionalWorksPage = React.lazy(() => import('./pages/additional-works/AdditionalWorksPage'));
const ReportsPage = React.lazy(() => import('./pages/reports/ReportsPage'));
const ConfigurationPage = React.lazy(() => import('./pages/configuration/ConfigurationPage'));
const ProductPhotosPage = React.lazy(() => import('./pages/product-photos/ProductPhotosPage'));
const MeasurementsListPage = React.lazy(() => import('./pages/measurements/MeasurementsListPage'));
const MeasurementFormPage = React.lazy(() => import('./pages/measurements/MeasurementFormPage'));
const CalculatorPage = React.lazy(() => import('./pages/calculator/CalculatorPage'));
const CashDailyPage = React.lazy(() => import('./pages/cash/CashDailyPage'));
const CashHistoryPage = React.lazy(() => import('./pages/cash/CashHistoryPage'));

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
          <Suspense fallback={<LoadingSpinner />}>
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
          </Suspense>
        </NotificationProvider>
      </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;