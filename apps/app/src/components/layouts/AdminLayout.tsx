import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

const NAV = [
  { to: '/admin',              label: 'Vue globale',    icon: '📊' },
  { to: '/admin/partners',     label: 'Partenaires',    icon: '🏪' },
  { to: '/admin/users',        label: 'Utilisateurs',   icon: '👥' },
  { to: '/admin/transactions', label: 'Transactions',   icon: '💸' },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛡️</span>
          <div>
            <span className="font-bold text-lg">ALTIVAX</span>
            <span className="ml-2 text-yellow-400 text-xs bg-yellow-400/20 px-2 py-0.5 rounded-full font-semibold">
              SUPER ADMIN
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{user?.firstName} {user?.lastName}</span>
          <button
            onClick={logout}
            className="text-xs bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg transition"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden md:flex flex-col w-56 bg-gray-800 text-white py-6 px-3 gap-1">
          {NAV.map(({ to, label, icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  active ? 'bg-yellow-500 text-gray-900 font-semibold' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="text-lg">{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </aside>

        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 flex justify-around py-2 z-50">
        {NAV.map(({ to, label, icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center text-xs gap-0.5 px-2 py-1 rounded-lg transition ${
                active ? 'text-yellow-400 font-semibold' : 'text-gray-400'
              }`}
            >
              <span className="text-xl">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
