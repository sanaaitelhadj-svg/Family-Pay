import { useEffect, useState } from 'react';
import { api } from '../api';

interface Commission {
  id: string;
  amount: number;
  rate: number;
  commissionType: string;
  status: string;
  createdAt: string;
  merchant: { businessName: string; city: string; category: string };
  transaction: { amount: number; createdAt: string; pspTransactionId: string };
  sponsor: { user: { firstName: string; phone: string } };
}

interface Stats {
  total: { _sum: { amount: number | null }; _count: number };
  byMerchant: { merchantId: string; _sum: { amount: number }; _count: number }[];
  byStatus: { status: string; _sum: { amount: number }; _count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  COLLECTED: 'bg-green-100 text-green-800',
  DISPUTED: 'bg-red-100 text-red-800',
};

export default function Commissions() {
  const [list, setList] = useState<Commission[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    const url = filter ? `/admin/commissions?status=${filter}` : '/admin/commissions';
    Promise.all([
      api.get(url),
      api.get('/admin/commissions/stats'),
    ]).then(([r1, r2]) => {
      setList(r1.data);
      setStats(r2.data);
    }).finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  const totalAmount = stats?.total._sum.amount ?? 0;
  const totalCount = stats?.total._count ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Commissions</h1>

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total commissions</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">{Number(totalAmount).toFixed(2)} MAD</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Nombre de transactions</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalCount}</p>
          </div>
          {stats.byStatus.map(s => (
            <div key={s.status} className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">{s.status}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{Number(s._sum.amount ?? 0).toFixed(2)} MAD</p>
              <p className="text-xs text-gray-400">{s._count} transactions</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {(['', 'PENDING', 'COLLECTED', 'DISPUTED'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${filter === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {s === '' ? 'Toutes' : s}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-500">Chargement...</p> : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {list.length === 0 ? (
            <p className="text-center text-gray-500 p-8">Aucune commission</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Marchand</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Sponsor</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tx montant</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Taux</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Commission</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {list.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{new Date(c.createdAt).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.merchant.businessName}</p>
                      <p className="text-xs text-gray-400">{c.merchant.category} · {c.merchant.city}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{c.sponsor.user.firstName}</p>
                      <p className="text-xs text-gray-400">{c.sponsor.user.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{Number(c.transaction.amount).toFixed(2)} MAD</td>
                    <td className="px-4 py-3 text-right text-gray-500">{(Number(c.rate) * 100).toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700">{Number(c.amount).toFixed(2)} MAD</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[c.status] ?? ''}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
