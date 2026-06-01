import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  Users, Gift, Store, CreditCard, TrendingUp, Shield,
  ArrowUpRight, Activity, AlertTriangle,
} from 'lucide-react';

interface LogEntry {
  id: string; action: string; entityType: string; entityId: string;
  result: string; actorRole: string | null; createdAt: string;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  admin?: { firstName?: string; email?: string } | null;
}

interface Stats {
  sponsors: number; beneficiaries: number; activeMerchants: number;
  totalTransactions: number; totalVolume: number; pendingFraudReview: number;
  merchantsByStatus: Record<string, number>; merchantsByCategory: Record<string, number>;
  newSponsorsWeek: number; newMerchantsWeek: number;
  weekVolume: number; weekTransactions: number; pendingKyc: number;
  recentLogs: LogEntry[];
}

const FIELD_LABELS: Record<string, string> = {
  firstName: 'Prénom', lastName: 'Nom', email: 'Email', phone: 'Téléphone',
  city: 'Ville', category: 'Catégorie', businessName: 'Raison sociale',
  isActive: 'Actif', status: 'Statut',
};

function KpiCard({ label, value, sub, icon: Icon, onClick, alert = false }: {
  label: string; value: string | number; sub?: string; icon: any; onClick?: () => void; alert?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="text-left w-full transition-all duration-200"
      style={{
        background: 'white', borderRadius: '16px', padding: '20px',
        border: `1px solid ${alert ? '#FEE2E2' : '#ECECF2'}`,
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.07)' : '0 1px 2px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}>
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280' }}>{label}</span>
        <div style={{ background: alert ? 'rgba(239,68,68,0.08)' : 'rgba(91,61,245,0.08)', borderRadius: '10px', padding: '8px' }}>
          <Icon size={16} strokeWidth={1.8} style={{ color: alert ? '#EF4444' : '#5B3DF5' }} />
        </div>
      </div>
      <p style={{ fontSize: '32px', fontWeight: 700, color: '#111827', lineHeight: 1, letterSpacing: '-0.5px' }}>{value}</p>
      {sub && <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '8px' }}>{sub}</p>}
    </button>
  );
}

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span style={{ fontSize: '13px', color: '#6B7280', width: '96px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div className="flex-1 rounded-full overflow-hidden" style={{ background: '#F3F4F6', height: '6px' }}>
        <div style={{ width: `${pct}%`, background: color, height: '6px', borderRadius: '99px', transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', width: '24px', textAlign: 'right' }}>{count}</span>
    </div>
  );
}

function DiffView({ previous, next, meta }: { previous: Record<string, unknown> | null; next: Record<string, unknown> | null; meta?: Record<string, unknown> | null }) {
  const prev = previous ?? (meta?.['before'] as Record<string, unknown> | null ?? null);
  const nxt  = next  ?? (meta?.['after']  as Record<string, unknown> | null ?? null);
  if (!prev && !nxt) return null;
  const allKeys = [...new Set([...Object.keys(prev ?? {}), ...Object.keys(nxt ?? {})])];
  if (allKeys.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid #ECECF2' }}>
      <div className="grid grid-cols-2 divide-x" style={{ borderColor: '#ECECF2' }}>
        <div className="px-3 py-2.5" style={{ background: 'rgba(239,68,68,0.04)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: '#EF4444' }}>Avant</p>
          {allKeys.map(k => (prev ?? {})[k] !== undefined ? (
            <div key={k} className="mb-1">
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{FIELD_LABELS[k] ?? k}</p>
              <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>{String((prev ?? {})[k])}</p>
            </div>
          ) : null)}
        </div>
        <div className="px-3 py-2.5" style={{ background: 'rgba(34,197,94,0.04)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: '#22C55E' }}>Après</p>
          {allKeys.map(k => (nxt ?? {})[k] !== undefined ? (
            <div key={k} className="mb-1">
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{FIELD_LABELS[k] ?? k}</p>
              <p className="text-xs font-semibold" style={{ color: '#16A34A' }}>{String((nxt ?? {})[k])}</p>
            </div>
          ) : null)}
        </div>
      </div>
    </div>
  );
}

function LogModal({ log, onClose }: { log: LogEntry; onClose: () => void }) {
  const meta = log.metadata as Record<string, unknown> | null;
  const metaEntries = meta ? Object.entries(meta).filter(([, v]) => typeof v !== 'object' || v === null) : [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #ECECF2', boxShadow: '0 24px 64px rgba(0,0,0,0.12)', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div>
            <p className="font-semibold text-sm" style={{ color: '#111827' }}>{log.action.replace(/_/g, ' ')}</p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{new Date(log.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none transition-colors" style={{ color: '#9CA3AF', background: '#F9FAFB' }}>×</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${log.result === 'SUCCESS' ? 'text-green-700' : 'text-red-700'}`}
              style={{ background: log.result === 'SUCCESS' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
              {log.result === 'SUCCESS' ? '✓ Succès' : '✗ Échec'}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: '#F3F4F6', color: '#6B7280' }}>{log.entityType}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3" style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
              <p className="text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>Entité</p>
              <p className="text-sm font-semibold" style={{ color: '#111827' }}>
                {log.entityType}{meta?.entityName ? ` — ${String(meta.entityName)}` : ''}
              </p>
              <p className="text-xs font-mono mt-0.5 truncate" style={{ color: '#D1D5DB' }}>{log.entityId}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
              <p className="text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>Admin</p>
              <p className="text-sm font-semibold" style={{ color: '#111827' }}>{log.admin?.firstName ?? log.admin?.email ?? 'Système'}</p>
            </div>
          </div>
          {metaEntries.filter(([k]) => k !== 'entityName').length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {metaEntries.filter(([k]) => k !== 'entityName').map(([k, v]) => (
                <div key={k} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(91,61,245,0.04)', border: '1px solid rgba(91,61,245,0.08)' }}>
                  <p className="text-xs mb-0.5" style={{ color: '#8B7CF8' }}>{k}</p>
                  <p className="text-sm font-semibold" style={{ color: '#3730A3' }}>{String(v)}</p>
                </div>
              ))}
            </div>
          )}
          <DiffView previous={log.previousData} next={log.newData} meta={meta} />
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
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#5B3DF5', borderTopColor: 'transparent' }} />
    </div>
  );
  if (!stats) return <p className="p-6 text-sm" style={{ color: '#6B7280' }}>Erreur de chargement</p>;

  const totalMerchants = Object.values(stats.merchantsByStatus).reduce((a, b) => a + b, 0);
  const totalCat = Object.values(stats.merchantsByCategory).reduce((a, b) => a + b, 0);

  return (
    <>
      {selectedLog && <LogModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>Tableau de bord</h1>
            <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button onClick={fetchStats} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'white', border: '1px solid #ECECF2', color: '#6B7280', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <Activity size={14} /> Actualiser
          </button>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard label="Sponsors" value={stats.sponsors} sub={`+${stats.newSponsorsWeek} cette semaine`} icon={Users} onClick={() => navigate('/sponsors')} />
          <KpiCard label="Bénéficiaires" value={stats.beneficiaries} icon={Gift} onClick={() => navigate('/beneficiaries')} />
          <KpiCard label="Marchands actifs" value={stats.activeMerchants} sub={`${stats.pendingKyc} KYC en attente`} icon={Store} onClick={() => navigate('/merchants')} />
          <KpiCard label="Transactions" value={stats.totalTransactions.toLocaleString('fr-FR')} sub={`${stats.weekTransactions} cette semaine`} icon={CreditCard} onClick={() => navigate('/transactions')} />
          <KpiCard label="Volume total" value={`${stats.totalVolume.toLocaleString('fr-FR')} MAD`} sub={`${stats.weekVolume.toLocaleString('fr-FR')} MAD / 7j`} icon={TrendingUp} onClick={() => navigate('/transactions')} />
          <KpiCard label="Fraude en attente" value={stats.pendingFraudReview} icon={Shield} onClick={() => navigate('/fraud')} alert={stats.pendingFraudReview > 0} />
        </div>

        {/* KYC Alert */}
        {stats.pendingKyc > 0 && (
          <div className="flex items-center justify-between px-5 py-4 rounded-2xl" style={{ background: '#FFF8E6', border: '1px solid #F5D98F' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.12)' }}>
                <AlertTriangle size={18} style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#92400E' }}>{stats.pendingKyc} marchand{stats.pendingKyc > 1 ? 's' : ''} en attente de validation KYC</p>
                <p style={{ fontSize: '13px', color: '#B45309', marginTop: '2px' }}>Des dossiers ont été soumis et attendent une décision.</p>
              </div>
            </div>
            <button onClick={() => navigate('/merchants')} className="px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5"
              style={{ background: '#F59E0B', color: 'white' }}>
              Voir <ArrowUpRight size={14} />
            </button>
          </div>
        )}

        {/* Charts + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* By status */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'white', border: '1px solid #ECECF2', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between">
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Marchands par statut</h2>
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Total {totalMerchants}</span>
            </div>
            <div className="space-y-3">
              {[
                { s: 'ACTIVE',    label: 'Actif',     color: '#22C55E' },
                { s: 'INACTIVE',  label: 'Inactif',   color: '#D1D5DB' },
                { s: 'SUSPENDED', label: 'Suspendu',  color: '#F59E0B' },
                { s: 'REJECTED',  label: 'Rejeté',    color: '#EF4444' },
              ].map(({ s, label, color }) => (
                <BarRow key={s} label={label} count={stats.merchantsByStatus[s] ?? 0} total={totalMerchants} color={color} />
              ))}
            </div>
          </div>

          {/* By category */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'white', border: '1px solid #ECECF2', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between">
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Par catégorie</h2>
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Total {totalCat}</span>
            </div>
            <div className="space-y-3">
              {Object.entries(stats.merchantsByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, count]) => (
                <BarRow key={cat} label={cat} count={count} total={totalCat} color="#5B3DF5" />
              ))}
              {Object.keys(stats.merchantsByCategory).length === 0 && (
                <p style={{ fontSize: '13px', color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>Aucun marchand</p>
              )}
            </div>
          </div>

          {/* Activity feed */}
          <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid #ECECF2', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Activité récente</h2>
              <button onClick={() => navigate('/audit-logs')} className="text-xs font-medium flex items-center gap-1 transition-colors" style={{ color: '#5B3DF5' }}>
                Tout voir <ArrowUpRight size={12} />
              </button>
            </div>
            <div className="space-y-0">
              {stats.recentLogs.map((log, i) => (
                <button key={log.id} onClick={() => setSelectedLog(log)}
                  className="w-full flex items-start gap-3 py-3 text-left transition-all group"
                  style={{ borderBottom: i < stats.recentLogs.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <div className="flex flex-col items-center pt-1 flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: log.result === 'SUCCESS' ? '#22C55E' : '#EF4444' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate group-hover:text-primary transition-colors" style={{ color: '#374151' }}>
                      {log.action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                      {log.admin?.firstName ?? log.admin?.email ?? 'Système'} · {new Date(log.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <ArrowUpRight size={12} className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#9CA3AF' }} />
                </button>
              ))}
              {stats.recentLogs.length === 0 && (
                <p style={{ fontSize: '13px', color: '#9CA3AF', textAlign: 'center', padding: '24px 0' }}>Aucune activité</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
