import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

const NAV = [
  { to: '/beneficiary', label: 'Accueil', icon: '🏠' },
  { to: '/beneficiary/qr', label: 'Mon QR', icon: '📱' },
  { to: '/beneficiary/transactions', label: 'Historique', icon: '📋' },
  { to: '/beneficiary/fund-request', label: 'Demande', icon: '💰' },
];

export function BeneficiaryLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-emerald-700 text-white px-4 py-3 flex items-center justify-between shadow">
        <div>
          <span className="font-bold text-lg">FamilyPay</span>
          <span className="ml-2 text-emerald-300 text-xs bg-emerald-800 px-2 py-0.5 rounded-full">Bénéficiaire</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-emerald-200">{user?.firstName}</span>
          <button onClick={logout} className="text-xs bg-emerald-600 hover:bg-emerald-500 px-2 py-1 rounded">
            Déconnexion
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 pb-24 max-w-lg mx-auto w-full">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 z-50">
        {NAV.map(({ to, label, icon }) => {
          const active = location.pathname === to;
          return (
            <Link key={to} to={to} className={`flex flex-col items-center text-xs gap-0.5 px-2 py-1 rounded-lg transition ${active ? 'text-emerald-700 font-semibold' : 'text-gray-500'}`}>
              <span className="text-xl">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
