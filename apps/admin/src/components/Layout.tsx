import { useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionsContext';

const NAV = [
  { to: '/',              label: '📊 Dashboard',        page: 'dashboard',      end: true },
  { to: '/sponsors',      label: '👥 Sponsors',         page: 'sponsors'                  },
  { to: '/beneficiaries', label: '🎁 Bénéficiaires',   page: 'beneficiaries'             },
  { to: '/merchants',     label: '🏪 Marchands KYC',   page: 'merchants'                 },
  { to: '/transactions',  label: '💳 Transactions',    page: 'transactions'              },
  { to: '/fraud',         label: '🔍 Revue fraude',    page: 'fraud'                     },
  { to: '/subscriptions', label: '📋 Abonnements',     page: 'subscriptions'             },
  { to: '/commissions',   label: '💰 Commissions',     page: 'commissions'               },
  { to: '/admins',        label: '🛡️ Administrateurs', page: 'admins'                    },
  { to: '/audit-logs',    label: '📜 Audit Logs',      page: 'auditLogs'                 },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
      {initials}
    </div>
  );
}

export default function Layout() {
  const { currentAdmin, refreshPermissions, can, permissions } = usePermissions();

  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  function logout() {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
  }

  const fullName = currentAdmin
    ? `${currentAdmin.firstName} ${currentAdmin.lastName}`
    : '';

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-60 bg-indigo-900 text-white flex flex-col">

        {/* Logo */}
        <div className="p-5 border-b border-indigo-700">
          <div className="text-lg font-bold tracking-wide">FamilyPay Admin</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.filter(({ page }) => can(page, 'read')).map(({ to, label, end }: any) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-700 text-white' : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Admin profile */}
        {currentAdmin ? (
          <div className="px-4 py-4 border-t border-indigo-700 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar name={fullName} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{fullName}</p>
                <p className="text-xs text-indigo-300 truncate">{currentAdmin.email}</p>
              </div>
            </div>

            {/* Role badge */}
            {currentAdmin.adminRole ? (
              <span className="inline-block text-xs bg-indigo-700 text-indigo-200 px-2 py-0.5 rounded-full">
                {currentAdmin.adminRole.name}
              </span>
            ) : (
              <span className="inline-block text-xs bg-green-700 text-green-200 px-2 py-0.5 rounded-full">
                ⭐ Super Admin
              </span>
            )}

            {/* Last login */}
            <div className="text-xs text-indigo-400 space-y-0.5">
              <p>Dernière connexion :</p>
              <p className="text-indigo-300">{formatDate(currentAdmin.lastLogin)}</p>
              {currentAdmin.lastIp && (
                <p className="font-mono text-indigo-400">{currentAdmin.lastIp}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 border-t border-indigo-700">
            <div className="w-8 h-8 rounded-full bg-indigo-700 animate-pulse" />
          </div>
        )}

        {/* Logout */}
        <button
          onClick={logout}
          className="mx-4 mb-4 px-4 py-2 text-sm text-indigo-300 hover:text-white border border-indigo-600 hover:border-indigo-400 rounded-lg transition-colors"
        >
          Déconnexion
        </button>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
