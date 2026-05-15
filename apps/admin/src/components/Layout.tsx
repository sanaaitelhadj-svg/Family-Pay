import { Outlet, NavLink, useNavigate } from 'react-router-dom';

export default function Layout() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem('admin_token');
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-56 bg-indigo-900 text-white flex flex-col">
        <div className="p-6 text-xl font-bold border-b border-indigo-700">FamilyPay Admin</div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/" end className={({ isActive }) =>
            `block px-4 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-indigo-700' : 'hover:bg-indigo-800'}`}>
            Dashboard
          </NavLink>
          <NavLink to="/fraud" className={({ isActive }) =>
            `block px-4 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-indigo-700' : 'hover:bg-indigo-800'}`}>
            Revue fraude
          </NavLink>
          <NavLink to="/merchants" className={({ isActive }) =>
            `block px-4 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-indigo-700' : 'hover:bg-indigo-800'}`}>
            Marchands KYC
          </NavLink>
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
