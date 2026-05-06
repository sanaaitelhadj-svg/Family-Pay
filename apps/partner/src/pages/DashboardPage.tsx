import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '../lib/api';

interface DashboardData {
  totalRevenue: number;
  todayRevenue: number;
  totalTransactions: number;
  todayTransactions: number;
  averageBasket: number;
  recentTransactions: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
}

export function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/api/dashboard/partner').then((r) => r.data),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-400">Chargement…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Tableau de bord</h1>
        <p className="text-sm text-gray-500">
          {format(new Date(), 'EEEE dd MMMM yyyy', { locale: fr })}
        </p>
      </div>

      {/* CA du jour */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white shadow-lg">
        <p className="text-blue-200 text-sm mb-1">CA aujourd'hui</p>
        <p className="text-4xl font-bold">
          {(data?.todayRevenue ?? 0).toFixed(2)}{' '}
          <span className="text-2xl font-normal">MAD</span>
        </p>
        <p className="text-blue-300 text-sm mt-2">
          {data?.todayTransactions ?? 0} transaction{(data?.todayTransactions ?? 0) > 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">CA total</p>
          <p className="text-xl font-bold text-gray-800">
            {(data?.totalRevenue ?? 0).toFixed(0)} MAD
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Panier moyen</p>
          <p className="text-xl font-bold text-gray-800">
            {(data?.averageBasket ?? 0).toFixed(0)} MAD
          </p>
        </div>
      </div>

      {/* Scanner CTA */}
      <Link
        to="/scan"
        className="block bg-blue-50 border-2 border-blue-500 rounded-2xl p-5 text-center hover:bg-blue-100 transition"
      >
        <div className="text-4xl mb-2">📷</div>
        <p className="font-semibold text-blue-800">Scanner un QR code</p>
        <p className="text-sm text-blue-600 mt-1">Accepter un paiement</p>
      </Link>

      {/* Transactions récentes */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Transactions récentes</h2>
        {!data?.recentTransactions?.length ? (
          <div className="bg-white rounded-xl p-4 text-center text-gray-400 text-sm border border-gray-100">
            Aucune transaction
          </div>
        ) : (
          <div className="space-y-2">
            {data.recentTransactions.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                className="bg-white rounded-xl p-3 flex items-center justify-between shadow-sm border border-gray-100"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">Paiement QR</p>
                  <p className="text-xs text-gray-400">
                    {tx.createdAt
                      ? format(new Date(tx.createdAt), 'dd MMM à HH:mm', { locale: fr })
                      : '—'}
                  </p>
                </div>
                <p className="font-semibold text-blue-700">
                  +{Number(tx.amount).toFixed(2)} MAD
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
