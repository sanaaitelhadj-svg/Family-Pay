import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '../lib/api';

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  PAYMENT:  { label: 'Paiement',   icon: '💳', color: 'text-red-600' },
  RELOAD:   { label: 'Recharge',   icon: '⬆️', color: 'text-emerald-600' },
  TRANSFER: { label: 'Transfert',  icon: '↔️', color: 'text-blue-600' },
};

export function TransactionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.get('/api/transactions').then(r => r.data),
  });

  const transactions = data?.transactions ?? data ?? [];

  return (
    <div className="space-y-3 py-2">
      <h2 className="text-xl font-bold text-gray-800">Historique</h2>

      {isLoading ? (
        <div className="text-center text-gray-400 py-8">Chargement...</div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow">
          Aucune transaction pour le moment
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx: any) => {
            const meta = TYPE_LABELS[tx.type] ?? { label: tx.type, icon: '💰', color: 'text-gray-600' };
            return (
              <div key={tx.id} className="bg-white rounded-xl p-4 shadow flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{meta.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800">{meta.label}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(tx.createdAt), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>
                <p className={`font-bold ${meta.color}`}>
                  {tx.type === 'PAYMENT' ? '-' : '+'}{Number(tx.amount).toFixed(2)} MAD
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
