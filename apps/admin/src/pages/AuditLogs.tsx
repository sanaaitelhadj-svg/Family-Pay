import { useEffect, useState } from 'react';
import { api } from '../api';

interface AuditLog {
  id: string; action: string; entityType: string; entityId: string;
  metadata: any; createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  TRANSACTION_COMPLETED: 'bg-green-100 text-green-700',
  TRANSACTION_FAILED: 'bg-red-100 text-red-700',
  FRAUD_REVIEW_APPROVED: 'bg-blue-100 text-blue-700',
  FRAUD_REVIEW_REJECTED: 'bg-orange-100 text-orange-700',
  MERCHANT_KYC_APPROVED: 'bg-purple-100 text-purple-700',
  MERCHANT_KYC_REJECTED: 'bg-red-100 text-red-700',
};

const FILTERS = [
  { label: 'Tous', value: '' },
  { label: 'Transactions', value: 'TRANSACTION' },
  { label: 'Fraude', value: 'FRAUD' },
  { label: 'KYC', value: 'MERCHANT_KYC' },
];

export default function AuditLogs() {
  const [list, setList] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  function load() {
    setLoading(true);
    const url = filter ? `/admin/audit-logs?action=${filter}` : '/admin/audit-logs';
    api.get(url).then(r => setList(r.data)).finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Logs</h1>
      <div className="flex gap-2 mb-6">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${filter === f.value ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {f.label}
          </button>
        ))}
      </div>
      {loading ? <p className="text-gray-500">Chargement...</p> : (
        <div className="space-y-2">
          {list.map(log => (
            <div key={log.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 text-left"
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                    {log.action}
                  </span>
                  <span className="text-sm text-gray-500">{log.entityType}</span>
                  <span className="text-xs text-gray-400 font-mono">{log.entityId.slice(0, 8)}...</span>
                </div>
                <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString('fr-FR')}</span>
              </button>
              {expanded === log.id && (
                <div className="px-5 pb-4 border-t border-gray-50">
                  <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-40 text-gray-700">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
          {list.length === 0 && <div className="bg-white rounded-2xl p-8 text-center text-gray-500 shadow-sm">Aucun log</div>}
        </div>
      )}
    </div>
  );
}
