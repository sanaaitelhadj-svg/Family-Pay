import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '../lib/api';

interface Transaction {
  id: string;
  type: string;
  amount: string | number;
  currency?: string;
  status: string;
  description?: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  QR_PAYMENT: 'Paiement QR',
  ENVELOPE_FUND: 'Recharge enveloppe',
  FUND_REQUEST: 'Demande de fonds',
};

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'text-emerald-600 bg-emerald-50',
  PENDING: 'text-orange-600 bg-orange-50',
  FAILED: 'text-red-600 bg-red-50',
};

export function TransactionsPage() {
  const { data: txs, isLoading, isError } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: async () => {
      const r = await api.get('/api/transactions');
      const d = r.data;
      return Array.isArray(d) ? d : (d.transactions ?? []);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Chargement…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-20 text-red-400">
        Erreur lors du chargement
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Historique des transactions</h1>

      {!txs || txs.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-400 border border-gray-100">
          <div className="text-4xl mb-2">📋</div>
          <p>Aucune transaction pour l'instant</p>
        </div>
      ) : (
        <div className="space-y-3">
          {txs.map((tx) => (
            <div
              key={tx.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">
                  {TYPE_LABEL[tx.type] ?? tx.type}
                </p>
                {tx.description && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{tx.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {tx.createdAt ? format(new Date(tx.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr }) : '—'}
                </p>
              </div>
              <div className="ml-4 text-right flex-shrink-0">
                <p className="font-semibold text-gray-800">
                  {parseFloat(String(tx.amount)).toFixed(2)} {tx.currency ?? 'MAD'}
                </p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    STATUS_COLOR[tx.status] ?? 'text-gray-500 bg-gray-100'
                  }`}
                >
                  {tx.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
