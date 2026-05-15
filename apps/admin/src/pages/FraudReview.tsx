import { useEffect, useState } from 'react';
import { api } from '../api';

interface Auth {
  id: string;
  amount: number;
  fraudScore: number;
  createdAt: string;
  beneficiary: { user: { firstName: string; phone: string } };
  merchant: { businessName: string; city: string };
  allocation: { category: string; remainingAmount: number };
}

export default function FraudReview() {
  const [list, setList] = useState<Auth[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/admin/fraud-review').then(r => setList(r.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function approve(id: string) {
    await api.patch(`/admin/${id}/approve`);
    load();
  }

  async function reject(id: string) {
    const reason = prompt('Raison du rejet :');
    if (!reason || reason.length < 5) return;
    await api.patch(`/admin/${id}/reject`, { reason });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Revue fraude</h1>
      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-500 shadow-sm">
          Aucune autorisation en attente
        </div>
      ) : (
        <div className="space-y-4">
          {list.map(auth => (
            <div key={auth.id} className="bg-white rounded-2xl p-6 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-semibold text-gray-900">
                  {auth.beneficiary.user.firstName} — {auth.beneficiary.user.phone}
                </p>
                <p className="text-sm text-gray-500">{auth.merchant.businessName} · {auth.merchant.city}</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-700 font-medium">{auth.amount} MAD</span>
                  <span className="text-orange-600 font-medium">Score : {auth.fraudScore}</span>
                  <span className="text-gray-400">{auth.allocation.category}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => approve(auth.id)}
                  className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600">
                  Approuver
                </button>
                <button onClick={() => reject(auth.id)}
                  className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600">
                  Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
