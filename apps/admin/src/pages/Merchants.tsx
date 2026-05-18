import { useEffect, useState } from 'react';
import { api } from '../api';

interface Merchant {
  id: string;
  businessName: string;
  city: string;
  address: string;
  category: string;
  kycStatus: string;
  registrationNumber: string | null;
  iceNumber: string | null;
  taxId: string | null;
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
  const [expanded, setExpanded] = useState<string | null>(null);

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
            <div key={m.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">{m.businessName}</p>
                  <p className="text-sm text-gray-500">{m.city} · {m.category}</p>
                  <p className="text-sm text-gray-400">{m.user.phone}</p>
                  <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[m.kycStatus] ?? ''}`}>
                    {m.kycStatus}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                    className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
                    {expanded === m.id ? 'Masquer' : 'Voir dossier'}
                  </button>
                  {m.kycStatus === 'PENDING_PSP' && (
                    <>
                      <button onClick={() => approve(m.id)}
                        className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600">
                        Approuver
                      </button>
                      <button onClick={() => reject(m.id)}
                        className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600">
                        Rejeter
                      </button>
                    </>
                  )}
                </div>
              </div>
              {expanded === m.id && (
                <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Dossier KYC</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400">Adresse</p>
                      <p className="text-sm text-gray-700">{m.address || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Registre de Commerce (RC)</p>
                      <p className={`text-sm font-medium ${m.registrationNumber ? 'text-gray-900' : 'text-red-400'}`}>
                        {m.registrationNumber || 'Non fourni'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">ICE</p>
                      <p className={`text-sm font-medium ${m.iceNumber ? 'text-gray-900' : 'text-red-400'}`}>
                        {m.iceNumber || 'Non fourni'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Patente (Tax ID)</p>
                      <p className={`text-sm font-medium ${m.taxId ? 'text-gray-900' : 'text-red-400'}`}>
                        {m.taxId || 'Non fourni'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
