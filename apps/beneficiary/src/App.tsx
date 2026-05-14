import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { QRPage } from './pages/QRPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { FundRequestPage } from './pages/FundRequestPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout><DashboardPage /></Layout>
        </ProtectedRoute>
      }/>
      <Route path="/qr" element={
        <ProtectedRoute>
          <Layout><QRPage /></Layout>
        </ProtectedRoute>
      }/>
      <Route path="/transactions" element={
        <ProtectedRoute>
          <Layout><TransactionsPage /></Layout>
        </ProtectedRoute>
      }/>
      <Route path="/fund-request" element={
        <ProtectedRoute>
          <Layout><FundRequestPage /></Layout>
        </ProtectedRoute>
      }/>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
