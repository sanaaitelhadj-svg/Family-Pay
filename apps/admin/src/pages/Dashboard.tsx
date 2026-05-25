import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface LogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  result: string;
  actorRole: string | null;
  createdAt: string;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  admin?: { firstName?: string; email?: string } | null;
}

interface Stats {
  sponsors: number; beneficiaries: number; activeMerchants: number;
  totalTransactions: number; totalVolume: number; pendingFraudReview: number;
  merchantsByStatus: Record<string, number>;
  merchantsByCategory: Record<string, number>;
  newSponsorsWeek: number; newMerchantsWeek: number;
  weekVolume: number; weekTransactions: number;
  pendingKyc: number;
  recentLogs: LogEntry[];
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

function JsonDiff({ previous, next }: { previous: Record<string, unknown> | null; next: Record<string, unknown> | null }) {
  const allKeys = new Set([...Object.keys(previous ?? {}), ...Object.keys(next ?? {})]);
  if (allKeys.size === 0) return null;
  const changedKeys = [...allKeys].filter(k => JSON.stringify((previous ?? {})[k]) !== JSON.stringify((next ?? {})[k]));
  if (changedKeys.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Modifications</p>
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        {changedKeys.map(key => (
          <div key={key} className="text-xs flex flex-wrap items-center gap-1">
            <span className="font-mono font-semibold text-gray-700 mr-1">{key}</span>
            {(previous ?? {})[key] !== undefined && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded line-through">
                {String((previous ?? {})[key])}
              </span>
            )}
            <span className="text-gray-400">→</span>
            {(next ?? {})[key] !== undefined && (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                {String((next ?? {})[key])}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LogModal({ log, onClose }: { log: LogEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-base font-bold text-gray-900">{log.action.replace(/_/g, ' ')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(log.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
            log.result === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {log.result === 'SUCCESS' ? '✓ Succès' : '✗ Échec'}
          </span>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Entité</p>
              <p className="text-gray-700 font-medium">{log.entityType}{log.metadata?.entityName ? ` — ${String(log.metadata.entityName)}` : ''}</p>
              <p className="text-gray-400 font-mono text-xs break-all">{log.entityId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Admin</p>
              <p className="text-gray-700">{log.admin?.firstName ?? log.admin?.email ?? 'Système'}</p>
            </div>
          </div>
          <JsonDiff previous={log.previousData} next={log.newData} />
          {(!log.previousData && !log.newData && log.metadata && Object.keys(log.metadata).length > 0) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Métadonnées</p>
              <pre className="bg-gray-50 border rounded p-2 text-xs overflow-auto max-h-32 text-gray-700">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
          {log.metadata && Object.keys(log.metadata).length > 0 && (log.previousData || log.newData) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Métadonnées</p>
              <pre className="bg-gray-50 border rounded p-2 text-xs overflow-auto max-h-32 text-gray-700">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const navigate = useNavigate();

  const fetchStats = useCallback(() => {
    api.get(`/admin/stats?_t=${Date.now()}`).then(r => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStats();
    const iv = setInterval(fetchStats, 30000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!stats) return <p className="text-gray-500 p-6">Erreur de chargement</p>;

  const totalMerchants = Object.values(stats.merchantsByStatus).reduce((a, b) => a + b, 0);
  const totalCatMerchants = Object.values(stats.merchantsByCategory).reduce((a, b) => a + b, 0);

  return (
    <>
      {selectedLog && <LogModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <span className="text-xs text-gray-400">{new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard label="Sponsors" value={stats.sponsors} sub={`+${stats.newSponsorsWeek} cette semaine`} color="border-indigo-500" onClick={() => navigate('/sponsors')} />
          <KpiCard label="Bénéficiaires" value={stats.beneficiaries} color="border-purple-500" onClick={() => navigate('/beneficiaries')} />
          <KpiCard label="Marchands actifs" value={stats.activeMerchants} sub={`${stats.pendingKyc} KYC en attente`} color="border-green-500" onClick={() => navigate('/merchants')} />
          <KpiCard label="Transactions" value={stats.totalTransactions.toLocaleString('fr-FR')} sub={`${stats.weekTransactions} cette semaine`} color="border-blue-500" onClick={() => navigate('/transactions')} />
          <KpiCard label="Volume total" value={`${stats.totalVolume.toLocaleString('fr-FR')} MAD`} sub={`${stats.weekVolume.toLocaleString('fr-FR')} MAD / 7j`} color="border-yellow-500" onClick={() => navigate('/transactions')} />
          <KpiCard label="Fraude en attente" value={stats.pendingFraudReview} color={stats.pendingFraudReview > 0 ? 'border-red-500' : 'border-gray-300'} onClick={() => navigate('/fraud')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Marchands par statut</h2>
            <div className="space-y-3">
              {['ACTIVE','PENDING','INACTIVE','SUSPENDED','REJECTED'].map(s => (
                <MiniBar key={s} label={s} count={stats.merchantsByStatus[s] ?? 0} total={totalMerchants} color={STATUS_COLORS[s] ?? 'bg-gray-400'} />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4 text-right">Total : {totalMerchants}</p>
          </div>

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

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Activité récente</h2>
            <div className="space-y-1">
              {stats.recentLogs.map(log => (
                <button key={log.id} onClick={() => setSelectedLog(log)}
                  className="w-full flex items-start gap-2 hover:bg-orange-50 rounded-lg px-2 py-1.5 transition-colors text-left group">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${log.result === 'SUCCESS' ? 'bg-orange-400' : 'bg-red-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800 truncate">{log.action.replace(/_/g,' ')}</p>
                    <p className="text-xs text-gray-400">
                      {log.admin?.firstName ?? log.admin?.email ?? 'Système'} · {new Date(log.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                    </p>
                  </div>
                  <span className="text-gray-300 group-hover:text-gray-500 text-xs shrink-0 mt-1">›</span>
                </button>
              ))}
              {stats.recentLogs.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Aucune activité</p>}
            </div>
            <button onClick={() => navigate('/audit-logs')} className="text-xs text-indigo-500 hover:text-indigo-700 mt-3 w-full text-right">Voir tous les logs →</button>
          </div>
        </div>

        {stats.pendingKyc > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-yellow-500 text-xl">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-yellow-800">{stats.pendingKyc} marchand{stats.pendingKyc > 1 ? 's' : ''} en attente de validation KYC</p>
                <p className="text-xs text-yellow-600">Des marchands ont soumis leur dossier et attendent une décision.</p>
              </div>
            </div>
            <button onClick={() => navigate('/merchants')} className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600">Voir →</button>
          </div>
        )}
      </div>
    </>
  );
}
