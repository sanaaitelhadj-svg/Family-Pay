import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';

const navItems = [
  { path: '/',             label: 'Accueil',       icon: '🏠' },
  { path: '/qr',          label: 'Mon QR',         icon: '📱' },
  { path: '/transactions', label: 'Historique',    icon: '📋' },
  { path: '/fund-request', label: 'Demande fonds', icon: '💸' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-emerald-700 text-white px-4 py-3 flex items-center justify-between shadow">
        <div>
          <span className="font-bold text-lg">FamilyPay</span>
          <span className="ml-2 text-emerald-200 text-sm">Bénéficiaire</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-emerald-200">{user?.firstName}</span>
          <button onClick={handleLogout} className="text-xs bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded-full">
            Déconnexion
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="bg-white border-t border-gray-200 flex justify-around py-2 shadow-lg">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center px-3 py-1 rounded-lg text-xs transition-colors ${
              location.pathname === item.path
                ? 'text-emerald-700 font-semibold'
                : 'text-gray-500 hover:text-emerald-600'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
