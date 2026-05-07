import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

function StatCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: string; color: string; sub?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <span className="text-4xl opacity-80">{icon}</span>
      </div>
    </div>
  );
}

const ROLE_COLORS: Record<string, string> = {
  PAYER: 'bg-indigo-100 text-indigo-700',
  BENEFICIARY: 'bg-emerald-100 text-emerald-700',
  PARTNER: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-yellow-100 text-yellow-700',
};

export function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/admin/stats').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: partnersData } = useQuery({
    queryKey: ['admin-partners-pending'],
    queryFn: () => api.get('/api/admin/partners?status=pending&limit=5').then(r => r.data),
    refetchInterval: 30_000,
  });

  const pending = partnersData?.partners ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg animate-pulse">Chargement des statistiques...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🛡️ Dashboard Super Admin</h1>
        <p className="text-gray-500 text-sm mt-1">Vue globale de la plateforme ALTIVAX FamilyPay</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Utilisateurs"
          value={stats?.totalUsers ?? 0}
          icon="👥"
          color="border-indigo-500"
        />
        <StatCard
          label="Partenaires actifs"
          value={stats?.totalPartners ?? 0}
          icon="🏪"
          color="border-blue-500"
          sub={`${stats?.pendingPartners ?? 0} en attente`}
        />
        <StatCard
          label="Transactions"
          value={stats?.totalTransactions ?? 0}
          icon="💸"
          color="border-emerald-500"
        />
        <StatCard
          label="Volume total"
          value={`${Number(stats?.totalVolume ?? 0).toFixed(0)} MAD`}
          icon="💰"
          color="border-yellow-500"
        />
      </div>

      {/* Répartition rôles */}
      {stats?.usersByRole && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-4">Répartition des utilisateurs</h2>
          <div className="flex flex-wrap gap-3">
            {stats.usersByRole.map((r: any) => (
              <div key={r.role} className={`px-4 py-2 rounded-full text-sm font-semibold ${ROLE_COLORS[r.role] ?? 'bg-gray-100 text-gray-700'}`}>
                {r.role} — {r.count}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Partenaires en attente */}
      {pending.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700">
              🔔 {pending.length} partenaire(s) en attente de validation
            </h2>
            <Link to="/admin/partners?status=pending" className="text-sm text-yellow-600 hover:underline font-medium">
              Voir tous →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {pending.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-gray-800">{p.businessName}</p>
                  <p className="text-sm text-gray-500">{p.user?.email} · {p.category}</p>
                  <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</p>
                </div>
                <Link
                  to="/admin/partners"
                  className="text-sm bg-yellow-500 hover:bg-yellow-400 text-white px-3 py-1.5 rounded-lg font-medium transition"
                >
                  Valider
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
          <p className="text-emerald-700 font-medium">✅ Aucun partenaire en attente de validation</p>
        </div>
      )}
    </div>
  );
}
