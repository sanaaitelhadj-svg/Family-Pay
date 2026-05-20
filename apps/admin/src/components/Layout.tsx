import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionsContext';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/sponsors', label: 'Sponsors' },
  { to: '/beneficiaries', label: 'Bénéficiaires' },
  { to: '/merchants', label: 'Marchands KYC' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/fraud', label: 'Revue fraude' },
  { to: '/audit-logs', label: 'Audit Logs' },
  { to: '/commissions', label: 'Commissions' },
  { to: '/subscriptions', label: 'Abonnements' },
  { to: '/admins', label: 'Administrateurs' },
];

export default function Layout() {
  const navigate = useNavigate();
  const { currentAdmin, refreshPermissions } = usePermissions();

  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  function logout() {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-56 bg-indigo-900 text-white flex flex-col">
        <div className="p-6 border-b border-indigo-700">
          <div className="text-xl font-bold">FamilyPay Admin</div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(({ to, label, end }: any) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) =>
              `block px-4 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-indigo-700' : 'hover:bg-indigo-800'}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        {/* Connected admin info */}
        {currentAdmin && (
          <div className="px-4 py-3 border-t border-indigo-700 space-y-1">
            <p className="text-xs text-indigo-300">Connecté en tant que</p>
            <p className="text-sm font-semibold text-white">{currentAdmin.firstName} {currentAdmin.lastName}</p>
            {currentAdmin.adminRole && (
              <span className="inline-block text-xs bg-indigo-700 text-indigo-200 px-2 py-0.5 rounded-full">
                {currentAdmin.adminRole.name}
              </span>
            )}
            {!currentAdmin.adminRole && (
              <span className="inline-block text-xs bg-green-700 text-green-200 px-2 py-0.5 rounded-full">
                Super Admin
              </span>
            )}
          </div>
        )}
        <button onClick={logout} className="m-4 px-4 py-2 text-sm text-indigo-300 hover:text-white border border-indigo-600 rounded-lg">
          Déconnexion
        </button>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
