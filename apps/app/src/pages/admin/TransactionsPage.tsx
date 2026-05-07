import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';

const TYPE_BADGES: Record<string, string> = {
  PAYMENT:  'bg-blue-100 text-blue-700',
  TRANSFER: 'bg-purple-100 text-purple-700',
  RELOAD:   'bg-emerald-100 text-emerald-700',
  REVERSAL: 'bg-red-100 text-red-700',
};

const STATUS_BADGES: Record<string, string> = {
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  PENDING:   'bg-yellow-100 text-yellow-700',
  FAILED:    'bg-red-100 text-red-700',
};

export function AdminTransactionsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-transactions', page],
    queryFn: () => api.get(`/api/admin/transactions?page=${page}&limit=30`).then(r => r.data),
    placeholderData: prev => prev,
  });

  const transactions = data?.transactions ?? [];

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">💸 Toutes les transactions</h1>
        <p className="text-gray-500 text-sm mt-1">{data?.total ?? 0} transactions au total</p>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400 animate-pulse">Chargement...</div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400">Aucune transaction</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {transactions.map((tx: any) => (
              <div key={tx.id} className="px-5 py-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TYPE_BADGES[tx.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {tx.type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGES[tx.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {tx.status}
                    </span>
                    <span className="text-lg font-bold text-gray-800">{Number(tx.amount).toFixed(2)} MAD</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(tx.createdAt).toLocaleString('fr-FR')}
                  </span>
                </div>

                <div className="mt-2 flex flex-col sm:flex-row gap-1 text-sm text-gray-500">
                  <div>
                    <span className="text-gray-400">De : </span>
                    <span className="font-medium">
                      {tx.senderWallet?.user
                        ? `${tx.senderWallet.user.firstName} ${tx.senderWallet.user.lastName} (${tx.senderWallet.user.role})`
                        : '—'}
                    </span>
                  </div>
                  <span className="hidden sm:inline text-gray-300 mx-2">→</span>
                  <div>
                    <span className="text-gray-400">Vers : </span>
                    <span className="font-medium">
                      {tx.receiverWallet?.user
                        ? `${tx.receiverWallet.user.firstName} ${tx.receiverWallet.user.lastName} (${tx.receiverWallet.user.role})`
                        : '—'}
                    </span>
                  </div>
                </div>

                {tx.metadata?.description && (
                  <p className="text-xs text-gray-400 mt-1 italic">📝 {tx.metadata.description}</p>
                )}
              </div>
            ))}
          </div>

          {(data?.pages ?? 1) > 1 && (
            <div className="flex justify-center gap-2 py-4 border-t border-gray-100">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40 text-sm">← Préc.</button>
              <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {data?.pages}</span>
              <button disabled={page === data?.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40 text-sm">Suiv. →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
