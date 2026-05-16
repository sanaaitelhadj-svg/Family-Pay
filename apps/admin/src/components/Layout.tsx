import { Outlet, NavLink, useNavigate } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/sponsors', label: 'Sponsors' },
  { to: '/beneficiaries', label: 'Bénéficiaires' },
  { to: '/merchants', label: 'Marchands KYC' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/fraud', label: 'Revue fraude' },
  { to: '/audit-logs', label: 'Audit Logs' },
];

export default function Layout() {
  const navigate = useNavigate();
  function logout() { localStorage.removeItem('admin_token'); navigate('/login'); }

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-56 bg-indigo-900 text-white flex flex-col">
        <div className="p-6 text-xl font-bold border-b border-indigo-700">FamilyPay Admin</div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) =>
              `block px-4 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-indigo-700' : 'hover:bg-indigo-800'}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <button onClick={logout} className="m-4 px-4 py-2 text-sm text-indigo-300 hover:text-white border border-indigo-600 rounded-lg">
          Déconnexion
        </button>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
