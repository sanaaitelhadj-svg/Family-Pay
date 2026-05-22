import { useEffect, useState, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL ?? '';

interface AdminInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  adminRole?: { name: string } | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  result: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorRole: string | null;
  admin?: AdminInfo | null;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  MERCHANT_ACTIVATED:       'bg-green-100  text-green-800',
  MERCHANT_REJECTED:        'bg-red-100    text-red-800',
  MERCHANT_KYC_APPROVED:    'bg-green-100  text-green-800',
  MERCHANT_KYC_REJECTED:    'bg-red-100    text-red-800',
  MERCHANT_SUSPENDED:       'bg-yellow-100 text-yellow-800',
  MERCHANT_REGISTERED:      'bg-blue-100   text-blue-800',
  ADMIN_CREATED:            'bg-purple-100 text-purple-800',
  ADMIN_DELETED:            'bg-red-100    text-red-800',
  USER_LOGGED_IN:           'bg-gray-100   text-gray-600',
  USER_VERIFIED:            'bg-teal-100   text-teal-800',
  TRANSACTION_COMPLETED:    'bg-green-100  text-green-800',
  AUTHORIZATION_APPROVED:   'bg-green-100  text-green-800',
  AUTHORIZATION_REJECTED:   'bg-red-100    text-red-800',
  AUTHORIZATION_PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

function ResultBadge({ result }: { result: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
      result === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {result === 'SUCCESS' ? '✓ Succès' : '✗ Échec'}
    </span>
  );
}

function JsonBlock({ data, label }: { data: Record<string, unknown> | null; label: string }) {
  if (!data || Object.keys(data).length === 0) return <span className="text-gray-400 italic">—</span>;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <pre className="bg-gray-50 border rounded p-2 text-xs overflow-auto max-h-40 text-gray-700">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function DetailModal({ log, onClose }: { log: AuditLogEntry; onClose: () => void }) {
  const adminName = log.admin
    ? (log.admin.firstName ? `${log.admin.firstName} ${log.admin.lastName ?? ''}` : log.admin.email)
    : log.actorId ? `ID: ${log.actorId.slice(0, 8)}…` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Détail de l'événement</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(log.createdAt).toLocaleString('fr-FR', {
                day: '2-digit', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Action + Result */}
          <div className="flex flex-wrap gap-3 items-center">
            <ActionBadge action={log.action} />
            <ResultBadge result={log.result} />
          </div>

          {/* Grid info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Entité concernée</p>
              <p className="text-gray-700 font-medium">{log.entityType}</p>
              <p className="text-gray-400 font-mono text-xs break-all">{log.entityId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Auteur de l'action</p>
              {adminName ? (
                <>
                  <p className="text-gray-700 font-medium">{adminName}</p>
                  {log.admin?.email && <p className="text-gray-400 text-xs">{log.admin.email}</p>}
                  {log.admin?.adminRole && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium">
                      {log.admin.adminRole.name}
                    </span>
                  )}
                  {!log.admin?.adminRole && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs font-medium">
                      ⭐ Super Admin
                    </span>
                  )}
                </>
              ) : (
                <p className="text-gray-400 italic text-sm">Système (automatique)</p>
              )}
            </div>
            {log.ipAddress && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Adresse IP</p>
                <p className="text-gray-700 font-mono text-sm">{log.ipAddress}</p>
              </div>
            )}
            {log.deviceInfo && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Appareil</p>
                <p className="text-gray-600 text-xs">{log.deviceInfo}</p>
              </div>
            )}
          </div>

          {/* Data diffs */}
          <div className="space-y-3">
            <JsonBlock data={log.previousData} label="Avant" />
            <JsonBlock data={log.newData}      label="Après" />
            <JsonBlock data={log.metadata}     label="Métadonnées" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuditLogs() {
  const [logs,    setLogs]    = useState<AuditLogEntry[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [entity,  setEntity]  = useState('');
  const [result,  setResult]  = useState('');
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({
        page: String(page), limit: String(limit), _t: String(Date.now()),
        ...(search ? { action: search } : {}),
        ...(entity ? { entity }         : {}),
        ...(result ? { result }         : {}),
      });
      const res = await fetch(`${API}/admin/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [page, search, entity, result]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {selected && <DetailModal log={selected} onClose={() => setSelected(null)} />}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          {total} entrée{total !== 1 ? 's' : ''} • Journaux immuables
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" placeholder="Action (ex: MERCHANT_ACTIVATED)"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <select value={entity} onChange={e => { setEntity(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="">Toutes les entités</option>
          <option value="Merchant">Marchand</option>
          <option value="User">Utilisateur</option>
          <option value="Transaction">Transaction</option>
          <option value="Authorization">Autorisation</option>
          <option value="Allocation">Allocation</option>
          <option value="Sponsor">Sponsor</option>
        </select>
        <select value={result} onChange={e => { setResult(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="">Tous résultats</option>
          <option value="SUCCESS">Succès</option>
          <option value="FAILURE">Échec</option>
        </select>
        <button onClick={() => { setSearch(''); setEntity(''); setResult(''); setPage(1); }}
          className="text-sm text-gray-500 hover:text-gray-700 underline">
          Réinitialiser
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-lg font-medium">Aucun log trouvé</p>
          <p className="text-sm mt-1">Les actions admin apparaîtront ici automatiquement.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Résultat</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Entité</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Admin</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Rôle</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id}
                  className="hover:bg-orange-50 cursor-pointer transition-colors"
                  onClick={() => setSelected(log)}
                  title="Cliquer pour voir les détails">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(log.createdAt).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
                  <td className="px-4 py-3"><ResultBadge result={log.result} /></td>
                  <td className="px-4 py-3 text-gray-600">{log.entityType}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {log.admin
                      ? (log.admin.firstName ? `${log.admin.firstName} ${log.admin.lastName ?? ''}` : log.admin.email)
                      : log.actorId
                        ? <span className="text-gray-400 font-mono text-xs">{log.actorId.slice(0, 8)}…</span>
                        : <span className="text-gray-400 italic text-xs">Système</span>}
                  </td>
                  <td className="px-4 py-3">
                    {log.admin?.adminRole
                      ? <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium">{log.admin.adminRole.name}</span>
                      : log.admin
                        ? <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs font-medium">⭐ Super Admin</span>
                        : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {log.ipAddress ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded border disabled:opacity-40 hover:bg-white">
                ← Précédent
              </button>
              <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded border disabled:opacity-40 hover:bg-white">
                Suivant →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
