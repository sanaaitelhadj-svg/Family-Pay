import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/auth.store';

// Auth
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// Layouts
import { PayerLayout } from './components/layouts/PayerLayout';
import { BeneficiaryLayout } from './components/layouts/BeneficiaryLayout';
import { PartnerLayout } from './components/layouts/PartnerLayout';

// Guards
import { ProtectedRoute } from './components/ProtectedRoute';

// Payer pages
import { PayerDashboard } from './pages/payer/DashboardPage';
import { CreateEnvelopePage } from './pages/payer/CreateEnvelopePage';

// Beneficiary pages
import { BeneficiaryDashboard } from './pages/beneficiary/DashboardPage';
import { BeneficiaryQRPage } from './pages/beneficiary/QRPage';
import { BeneficiaryTransactions } from './pages/beneficiary/TransactionsPage';
import { FundRequestPage } from './pages/beneficiary/FundRequestPage';

// Partner pages
import { PartnerDashboard } from './pages/partner/DashboardPage';
import { PartnerScanPage } from './pages/partner/ScanPage';
import { PartnerTransactions } from './pages/partner/TransactionsPage';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

function RoleRedirect() {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'PAYER') return <Navigate to="/payer" replace />;
  if (user.role === 'BENEFICIARY') return <Navigate to="/beneficiary" replace />;
  if (user.role === 'PARTNER') return <Navigate to="/partner" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <Toaster position="top-center" />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<RoleRedirect />} />

        {/* PAYER */}
        <Route path="/payer" element={<ProtectedRoute roles={['PAYER']}><PayerLayout><PayerDashboard /></PayerLayout></ProtectedRoute>} />
        <Route path="/payer/envelopes/new" element={<ProtectedRoute roles={['PAYER']}><PayerLayout><CreateEnvelopePage /></PayerLayout></ProtectedRoute>} />

        {/* BENEFICIARY */}
        <Route path="/beneficiary" element={<ProtectedRoute roles={['BENEFICIARY']}><BeneficiaryLayout><BeneficiaryDashboard /></BeneficiaryLayout></ProtectedRoute>} />
        <Route path="/beneficiary/qr" element={<ProtectedRoute roles={['BENEFICIARY']}><BeneficiaryLayout><BeneficiaryQRPage /></BeneficiaryLayout></ProtectedRoute>} />
        <Route path="/beneficiary/transactions" element={<ProtectedRoute roles={['BENEFICIARY']}><BeneficiaryLayout><BeneficiaryTransactions /></BeneficiaryLayout></ProtectedRoute>} />
        <Route path="/beneficiary/fund-request" element={<ProtectedRoute roles={['BENEFICIARY']}><BeneficiaryLayout><FundRequestPage /></BeneficiaryLayout></ProtectedRoute>} />

        {/* PARTNER */}
        <Route path="/partner" element={<ProtectedRoute roles={['PARTNER']}><PartnerLayout><PartnerDashboard /></PartnerLayout></ProtectedRoute>} />
        <Route path="/partner/scan" element={<ProtectedRoute roles={['PARTNER']}><PartnerLayout><PartnerScanPage /></PartnerLayout></ProtectedRoute>} />
        <Route path="/partner/transactions" element={<ProtectedRoute roles={['PARTNER']}><PartnerLayout><PartnerTransactions /></PartnerLayout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}
