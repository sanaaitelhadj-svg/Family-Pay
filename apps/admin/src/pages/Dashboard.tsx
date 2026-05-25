import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Stats {
  sponsors: number; beneficiaries: number; activeMerchants: number;
  totalTransactions: number; totalVolume: number; pendingFraudReview: number;
  merchantsByStatus: Record<string, number>;
  merchantsByCategory: Record<string, number>;
  newSponsorsWeek: number; newMerchantsWeek: number;
  weekVolume: number; weekTransactions: number;
  pendingKyc: number;
  recentLogs: { id: string; action: string; entityType: string; createdAt: string; actor?: { firstName?: string; email?: string } | null }[];
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500', INACTIVE: 'bg-gray-400', PENDING: 'bg-yellow-500',
  SUSPENDED: 'bg-orange-500', REJECTED: 'bg-red-500',
};

function KpiCard({ label, value, sub, color, onClick }: { label: string; value: string | number; sub?: string; color: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${color} text-left hover:shadow-md transition-all w-full`}>
      <p className="text-xs text-gray-500 uppercase font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </button>
  );
}

function MiniBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-24 truncate shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</span>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/admin/stats?_t=${Date.now()}`).then(r => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!stats) return <p className="text-gray-500 p-6">Erreur de chargement</p>;

  const totalMerchants = Object.values(stats.merchantsByStatus).reduce((a, b) => a + b, 0);
  const totalCatMerchants = Object.values(stats.merchantsByCategory).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <span className="text-xs text-gray-400">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Sponsors" value={stats.sponsors} sub={`+${stats.newSponsorsWeek} cette semaine`} color="border-indigo-500" onClick={() => navigate('/sponsors')} />
        <KpiCard label="Bénéficiaires" value={stats.beneficiaries} color="border-purple-500" onClick={() => navigate('/beneficiaries')} />
        <KpiCard label="Marchands actifs" value={stats.activeMerchants} sub={`${stats.pendingKyc} KYC en attente`} color="border-green-500" onClick={() => navigate('/merchants')} />
        <KpiCard label="Transactions" value={stats.totalTransactions.toLocaleString('fr-FR')} sub={`${stats.weekTransactions} cette semaine`} color="border-blue-500" onClick={() => navigate('/transactions')} />
        <KpiCard label="Volume total" value={`${stats.totalVolume.toLocaleString('fr-FR')} MAD`} sub={`${stats.weekVolume.toLocaleString('fr-FR')} MAD / 7j`} color="border-yellow-500" onClick={() => navigate('/transactions')} />
        <KpiCard label="Fraude en attente" value={stats.pendingFraudReview} color={stats.pendingFraudReview > 0 ? 'border-red-500' : 'border-gray-300'} onClick={() => navigate('/fraud')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Merchants by status */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Marchands par statut</h2>
          <div className="space-y-3">
            {['ACTIVE','PENDING','INACTIVE','SUSPENDED','REJECTED'].map(s => (
              <MiniBar key={s} label={s} count={stats.merchantsByStatus[s] ?? 0} total={totalMerchants} color={STATUS_COLORS[s] ?? 'bg-gray-400'} />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4 text-right">Total : {totalMerchants}</p>
        </div>

        {/* Merchants by category */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Marchands par catégorie</h2>
          <div className="space-y-3">
            {Object.entries(stats.merchantsByCategory).sort((a,b) => b[1]-a[1]).map(([cat, count]) => (
              <MiniBar key={cat} label={cat} count={count} total={totalCatMerchants} color="bg-orange-400" />
            ))}
            {Object.keys(stats.merchantsByCategory).length === 0 && <p className="text-xs text-gray-400 text-center py-4">Aucun marchand</p>}
          </div>
          <p className="text-xs text-gray-400 mt-4 text-right">Total : {totalCatMerchants}</p>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Activité récente</h2>
          <div className="space-y-3">
            {stats.recentLogs.map(log => (
              <div key={log.id} className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{log.action.replace(/_/g,' ')}</p>
                  <p className="text-xs text-gray-400">
                    {log.actor?.firstName ?? log.actor?.email ?? 'Système'} · {new Date(log.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {stats.recentLogs.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Aucune activité</p>}
          </div>
          <button onClick={() => navigate('/audit-logs')} className="text-xs text-indigo-500 hover:text-indigo-700 mt-3 w-full text-right">Voir tous les logs →</button>
        </div>
      </div>

      {/* Pending KYC alert */}
      {stats.pendingKyc > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-yellow-500 text-xl">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-yellow-800">{stats.pendingKyc} marchand{stats.pendingKyc > 1 ? 's' : ''} en attente de validation KYC</p>
              <p className="text-xs text-yellow-600">Des marchands ont soumis leur dossier et attendent une décision.</p>
            </div>
          </div>
          <button onClick={() => navigate('/merchants')} className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600">
            Voir →
          </button>
        </div>
      )}
    </div>
  );
}
