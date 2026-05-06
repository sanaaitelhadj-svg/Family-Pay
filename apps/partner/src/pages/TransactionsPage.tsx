import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '../lib/api';

interface Transaction {
  id: string;
  amount: string | number;
  status: string;
  createdAt: string;
  envelopeId?: string;
}

export function TransactionsPage() {
  const { data, isLoading, isError } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: async () => {
      const r = await api.get('/api/transactions');
      const d = r.data;
      return Array.isArray(d) ? d : (d.transactions ?? []);
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-400">Chargement…</div>;
  }

  if (isError) {
    return <div className="flex items-center justify-center py-20 text-red-400">Erreur de chargement</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Historique des transactions</h1>

      {!data || data.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-400 border border-gray-100">
          <div className="text-4xl mb-2">📋</div>
          <p>Aucune transaction pour l'instant</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((tx) => (
            <div
              key={tx.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-800 text-sm">Paiement QR</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {tx.createdAt
                    ? format(new Date(tx.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })
                    : '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-blue-700">
                  +{parseFloat(String(tx.amount)).toFixed(2)} MAD
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  tx.status === 'COMPLETED'
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-gray-500 bg-gray-100'
                }`}>
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
