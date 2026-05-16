import { useEffect, useState } from 'react';
import { api } from '../api';

interface Transaction {
  id: string; amount: number; status: string; pspTransactionId: string; createdAt: string;
  merchant: { businessName: string; category: string; city: string };
  authorization: { amount: number; fraudScore: number; beneficiary: { user: { firstName: string; phone: string } } };
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

export default function Transactions() {
  const [list, setList] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    const url = filter ? `/admin/transactions?status=${filter}` : '/admin/transactions';
    api.get(url).then(r => setList(r.data)).finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Transactions</h1>
      <div className="flex gap-2 mb-6">
        {['', 'COMPLETED', 'FAILED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${filter === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {s === '' ? 'Toutes' : s}
          </button>
        ))}
      </div>
      {loading ? <p className="text-gray-500">Chargement...</p> : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date', 'Bénéficiaire', 'Marchand', 'Montant', 'Fraude', 'PSP ID', 'Statut'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{new Date(t.createdAt).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.authorization?.beneficiary?.user?.firstName}</p>
                    <p className="text-xs text-gray-400">{t.authorization?.beneficiary?.user?.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.merchant?.businessName}</p>
                    <p className="text-xs text-gray-400">{t.merchant?.category} · {t.merchant?.city}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold">{Number(t.amount).toFixed(2)} MAD</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${(t.authorization?.fraudScore ?? 0) >= 40 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.authorization?.fraudScore ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{t.pspTransactionId}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-500'}`}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="text-center text-gray-500 py-8">Aucune transaction</p>}
        </div>
      )}
    </div>
  );
}
