import { useEffect, useState } from 'react';
import { api } from '../api';

interface Merchant {
  id: string;
  businessName: string;
  city: string;
  category: string;
  kycStatus: string;
  user: { firstName: string; phone: string; email: string | null };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_PSP: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function Merchants() {
  const [list, setList] = useState<Merchant[]>([]);
  const [filter, setFilter] = useState('PENDING_PSP');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get(`/admin/merchants?kycStatus=${filter}`).then(r => setList(r.data)).finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  async function approve(id: string) {
    await api.patch(`/admin/merchants/${id}/approve`);
    load();
  }

  async function reject(id: string) {
    const reason = prompt('Raison du rejet KYC :');
    if (!reason || reason.length < 5) return;
    await api.patch(`/admin/merchants/${id}/reject`, { reason });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Marchands KYC</h1>
      <div className="flex gap-2 mb-6">
        {(['PENDING_PSP', 'APPROVED', 'REJECTED'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${filter === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {s === 'PENDING_PSP' ? 'En attente' : s === 'APPROVED' ? 'Approuvés' : 'Rejetés'}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-500 shadow-sm">Aucun marchand</div>
      ) : (
        <div className="space-y-4">
          {list.map(m => (
            <div key={m.id} className="bg-white rounded-2xl p-6 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-semibold text-gray-900">{m.businessName}</p>
                <p className="text-sm text-gray-500">{m.city} · {m.category}</p>
                <p className="text-sm text-gray-400">{m.user.phone}</p>
                <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[m.kycStatus] ?? ''}`}>
                  {m.kycStatus}
                </span>
              </div>
              {m.kycStatus === 'PENDING_PSP' && (
                <div className="flex gap-2">
                  <button onClick={() => approve(m.id)}
                    className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600">
                    Approuver
                  </button>
                  <button onClick={() => reject(m.id)}
                    className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600">
                    Rejeter
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
