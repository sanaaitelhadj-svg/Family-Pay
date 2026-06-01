import { useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionsContext';
import {
  LayoutDashboard, Users, Gift, Store, CreditCard,
  Shield, FileText, DollarSign, ShieldCheck, ScrollText, LogOut,
} from 'lucide-react';

const NAV = [
  { to: '/',              label: 'Dashboard',        page: 'dashboard',     Icon: LayoutDashboard, end: true },
  { to: '/sponsors',      label: 'Sponsors',         page: 'sponsors',      Icon: Users },
  { to: '/beneficiaries', label: 'Bénéficiaires',   page: 'beneficiaries', Icon: Gift },
  { to: '/merchants',     label: 'Marchands',        page: 'merchants',     Icon: Store },
  { to: '/transactions',  label: 'Transactions',     page: 'transactions',  Icon: CreditCard },
  { to: '/fraud',         label: 'Revue fraude',     page: 'fraud',         Icon: Shield },
  { to: '/subscriptions', label: 'Abonnements',      page: 'subscriptions', Icon: FileText },
  { to: '/commissions',   label: 'Commissions',      page: 'commissions',   Icon: DollarSign },
  { to: '/admins',        label: 'Administrateurs',  page: 'admins',        Icon: ShieldCheck },
  { to: '/audit-logs',    label: 'Audit Logs',       page: 'auditLogs',     Icon: ScrollText },
];

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || 'A';
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ background: 'linear-gradient(135deg,#8B5CF6,#5B3DF5)' }}>
      {initials}
    </div>
  );
}

export default function Layout() {
  const { currentAdmin, refreshPermissions, can } = usePermissions();
  useEffect(() => { refreshPermissions(); }, [refreshPermissions]);

  const fullName = currentAdmin ? `${currentAdmin.firstName} ${currentAdmin.lastName ?? ''}`.trim() : '';

  return (
    <div className="min-h-screen flex" style={{ background: '#F8F8FC' }}>

      {/* ── Sidebar ── */}
      <aside className="w-56 flex flex-col flex-shrink-0 fixed h-screen"
        style={{ background: '#241B52', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Logo */}
        <div className="px-4 py-4 flex items-center gap-2.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#5B3DF5)' }}>
            <span className="text-white text-xs font-bold">FP</span>
          </div>
          <span className="text-white font-semibold text-sm">FamilyPay</span>
          <span className="ml-auto text-xs px-1.5 py-0.5 rounded-md font-medium"
            style={{ background: 'rgba(139,92,246,0.18)', color: '#C4B5FD' }}>
            Admin
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.filter(({ page }) => can(page, 'read')).map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150"
              style={({ isActive }) => isActive
                ? { background: 'rgba(255,255,255,0.09)', borderLeft: '2px solid #8B5CF6', color: '#fff', paddingLeft: '10px' }
                : { color: 'rgba(255,255,255,0.5)', borderLeft: '2px solid transparent', paddingLeft: '10px' }
              }
              onMouseEnter={e => { if (!(e.currentTarget as HTMLElement).style.background.includes('0.09')) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (!(e.currentTarget as HTMLElement).style.background.includes('0.09')) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Icon size={15} strokeWidth={1.8} className="flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Profile */}
        <div className="px-3 pb-4 pt-3 space-y-2.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {currentAdmin ? (
            <>
              <div className="flex items-center gap-2.5">
                <Avatar name={fullName || 'Admin'} />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-xs font-semibold truncate">{fullName || 'Admin'}</p>
                  <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>{currentAdmin.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {currentAdmin.adminRole
                  ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(139,92,246,0.15)', color: '#C4B5FD' }}>{currentAdmin.adminRole.name}</span>
                  : <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.15)', color: '#86EFAC' }}>Super Admin</span>
                }
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>{fmt(currentAdmin.lastLogin)}</span>
              </div>
              <button onClick={() => { localStorage.removeItem('admin_token'); window.location.href = '/login'; }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{ color: 'rgba(255,255,255,0.38)', background: 'rgba(255,255,255,0.04)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; (e.currentTarget as HTMLElement).style.color = '#FCA5A5'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.38)'; }}
              >
                <LogOut size={13} /> Déconnexion
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div className="h-2 rounded-full w-2/3 animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto ml-56" style={{ background: '#F8F8FC' }}>
        <Outlet />
      </main>
    </div>
  );
}
