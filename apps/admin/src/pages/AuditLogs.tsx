import { useEffect, useState } from 'react';
import { api } from '../api';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: any;
  createdAt: string;
  userId?: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  MERCHANT_ACTIVATED:   { label: 'Marchand activé',    color: 'bg-green-100 text-green-700' },
  MERCHANT_REJECTED:    { label: 'Marchand rejeté',    color: 'bg-red-100 text-red-700' },
  MERCHANT_CREATED:     { label: 'Marchand créé',      color: 'bg-blue-100 text-blue-700' },
  ADMIN_CREATED:        { label: 'Admin créé',         color: 'bg-purple-100 text-purple-700' },
  SPONSOR_CREATED:      { label: 'Sponsor créé',       color: 'bg-indigo-100 text-indigo-700' },
  BENEFICIARY_CREATED:  { label: 'Bénéficiaire créé',  color: 'bg-yellow-100 text-yellow-700' },
  PLAN_CREATED:         { label: 'Plan créé',          color: 'bg-cyan-100 text-cyan-700' },
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  useEffect(() => {
    api.get('/audit-logs')
      .then((r: any) => setLogs(Array.isArray(r.data) ? r.data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(l =>
    !filter ||
    l.action.toLowerCase().includes(filter.toLowerCase()) ||
    l.entityType.toLowerCase().includes(filter.toLowerCase()) ||
    l.entityId.toLowerCase().includes(filter.toLowerCase())
  );

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const fmt = (d: string) => new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs ({filtered.length})</h1>
        <input
          type="text"
          placeholder="Filtrer par action, entité..."
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-gray-400">Chargement...</p>
        ) : paginated.length === 0 ? (
          <p className="p-8 text-center text-gray-400">Aucun log</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Date</th>
                <th className="text-left p-4 font-medium text-gray-600">Action</th>
                <th className="text-left p-4 font-medium text-gray-600">Entité</th>
                <th className="text-left p-4 font-medium text-gray-600">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((log) => {
                const badge = ACTION_LABELS[log.action];
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="p-4 text-gray-500 whitespace-nowrap">{fmt(log.createdAt)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {badge?.label ?? log.action}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-gray-700">{log.entityType}</span>
                      <span className="text-gray-400 text-xs ml-2">{log.entityId.slice(0, 8)}…</span>
                    </td>
                    <td className="p-4 text-gray-500 text-xs max-w-xs truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
