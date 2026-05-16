import { useEffect, useState } from 'react';
import { api } from '../api';

interface Beneficiary {
  id: string; isActive: boolean; createdAt: string;
  user: { firstName: string; phone: string; createdAt: string };
  sponsor: { user: { firstName: string } };
  _count: { allocations: number };
}

export default function Beneficiaries() {
  const [list, setList] = useState<Beneficiary[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/admin/beneficiaries').then(r => setList(r.data)).finally(() => setLoading(false)); }, []);

  async function openDetail(id: string) {
    const res = await api.get(`/admin/beneficiaries/${id}`);
    setDetail(res.data);
  }

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Bénéficiaires ({list.length})</h1>
        <div className="space-y-3">
          {list.map(b => (
            <button key={b.id} onClick={() => openDetail(b.id)}
              className={`w-full bg-white rounded-2xl p-5 shadow-sm text-left hover:shadow-md transition-shadow border-2 ${detail?.id === b.id ? 'border-indigo-500' : 'border-transparent'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-900">{b.user.firstName}</p>
                  <p className="text-sm text-gray-500">{b.user.phone}</p>
                  <p className="text-xs text-gray-400">Sponsor : {b.sponsor.user.firstName}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {b.isActive ? 'Actif' : 'Inactif'}
                  </span>
                  <p className="text-sm text-gray-400 mt-1">{b._count.allocations} alloc.</p>
                </div>
              </div>
            </button>
          ))}
          {list.length === 0 && <div className="bg-white rounded-2xl p-8 text-center text-gray-500 shadow-sm">Aucun bénéficiaire</div>}
        </div>
      </div>

      {detail && (
        <div className="w-96 bg-white rounded-2xl p-6 shadow-sm h-fit sticky top-0 max-h-screen overflow-y-auto">
          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-bold">{detail.user.firstName}</h2>
            <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          <p className="text-sm text-gray-500 mb-4">{detail.user.phone}</p>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Allocations</p>
          <div className="space-y-2 mb-6">
            {detail.allocations?.map((a: any) => (
              <div key={a.id} className="text-sm bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex justify-between">
                  <span className="font-medium">{a.category}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.status}</span>
                </div>
                <div className="text-gray-500 mt-1">{Number(a.remainingAmount).toFixed(0)} / {Number(a.limitAmount).toFixed(0)} MAD</div>
              </div>
            ))}
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Dernières transactions</p>
          <div className="space-y-2">
            {detail.transactions?.slice(0, 10).map((t: any) => (
              <div key={t.id} className="text-sm bg-gray-50 rounded-lg px-3 py-2 flex justify-between">
                <div>
                  <p className="font-medium">{t.merchant?.businessName}</p>
                  <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{Number(t.amount).toFixed(0)} MAD</p>
                  <span className={`text-xs ${t.status === 'COMPLETED' ? 'text-green-600' : 'text-red-500'}`}>{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
