import { useEffect, useState, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL ?? '';

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  admin?: { firstName: string; lastName: string; email: string } | null;
}

const ACTION_COLORS: Record<string, string> = {
  MERCHANT_ACTIVATED:  'bg-green-100 text-green-800',
  MERCHANT_REJECTED:   'bg-red-100 text-red-800',
  MERCHANT_SUSPENDED:  'bg-yellow-100 text-yellow-800',
  ADMIN_CREATED:       'bg-blue-100 text-blue-800',
  ADMIN_DELETED:       'bg-red-100 text-red-800',
  ROLE_ASSIGNED:       'bg-purple-100 text-purple-800',
};

function Badge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {action.replace(/_/g, ' ')}
    </span>
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
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({
        page: String(page), limit: String(limit),
        ...(search ? { action: search } : {}),
        ...(entity ? { entity }         : {}),
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
  }, [page, search, entity]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">{total} entrée{total !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text" placeholder="Filtrer par action…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="">Toutes les entités</option>
          <option value="Merchant">Marchand</option>
          <option value="User">Utilisateur</option>
          <option value="AdminRole">Rôle Admin</option>
          <option value="Subscription">Abonnement</option>
        </select>
        <button onClick={() => { setSearch(''); setEntity(''); setPage(1); }}
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
          <p className="text-lg font-medium">Aucun log trouvé</p>
          <p className="text-sm mt-1">Les actions admin apparaîtront ici.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Date','Action','Entité','ID','Admin','Détails'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}
                  </td>
                  <td className="px-4 py-3"><Badge action={log.action} /></td>
                  <td className="px-4 py-3 text-gray-600">{log.entityType}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs truncate max-w-[100px]" title={log.entityId}>{log.entityId}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {log.admin ? `${log.admin.firstName} ${log.admin.lastName}` : <span className="text-gray-400 italic">Système</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[180px]">
                    {log.metadata ? JSON.stringify(log.metadata) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                className="px-3 py-1.5 text-sm rounded border disabled:opacity-40 hover:bg-white">← Précédent</button>
              <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                className="px-3 py-1.5 text-sm rounded border disabled:opacity-40 hover:bg-white">Suivant →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
