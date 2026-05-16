import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FraudReview from './pages/FraudReview';
import Merchants from './pages/Merchants';
import Sponsors from './pages/Sponsors';
import Beneficiaries from './pages/Beneficiaries';
import Transactions from './pages/Transactions';
import AuditLogs from './pages/AuditLogs';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="sponsors" element={<Sponsors />} />
          <Route path="beneficiaries" element={<Beneficiaries />} />
          <Route path="merchants" element={<Merchants />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="fraud" element={<FraudReview />} />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
