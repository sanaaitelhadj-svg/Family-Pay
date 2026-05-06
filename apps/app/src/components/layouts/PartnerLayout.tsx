import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

const NAV = [
  { to: '/partner', label: 'Dashboard', icon: '📊' },
  { to: '/partner/scan', label: 'Scanner', icon: '📷' },
  { to: '/partner/transactions', label: 'Transactions', icon: '📋' },
];

export function PartnerLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-blue-700 text-white px-4 py-3 flex items-center justify-between shadow">
        <div>
          <span className="font-bold text-lg">FamilyPay</span>
          <span className="ml-2 text-blue-300 text-xs bg-blue-800 px-2 py-0.5 rounded-full">Partenaire</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-blue-200">{user?.firstName}</span>
          <button onClick={logout} className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded">
            Déconnexion
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 pb-24 max-w-lg mx-auto w-full">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 z-50">
        {NAV.map(({ to, label, icon }) => {
          const active = location.pathname === to;
          return (
            <Link key={to} to={to} className={`flex flex-col items-center text-xs gap-0.5 px-2 py-1 rounded-lg transition ${active ? 'text-blue-700 font-semibold' : 'text-gray-500'}`}>
              <span className="text-xl">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
