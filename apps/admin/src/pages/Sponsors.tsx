import { useEffect, useState } from 'react';
import { api } from '../api';

interface Sponsor {
  id: string; createdAt: string;
  user: { firstName: string; phone: string; email: string | null; createdAt: string };
  _count: { allocations: number; beneficiaries: number };
}

interface SponsorDetail {
  id: string;
  user: { firstName: string; phone: string; email: string | null };
  totalVolume: number; totalTransactions: number;
  allocations: any[]; beneficiaries: any[];
}

export default function Sponsors() {
  const [list, setList] = useState<Sponsor[]>([]);
  const [detail, setDetail] = useState<SponsorDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/admin/sponsors').then(r => setList(r.data)).finally(() => setLoading(false)); }, []);

  async function openDetail(id: string) {
    const res = await api.get(`/admin/sponsors/${id}`);
    setDetail(res.data);
  }

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Sponsors ({list.length})</h1>
        <div className="space-y-3">
          {list.map(s => (
            <button key={s.id} onClick={() => openDetail(s.id)}
              className={`w-full bg-white rounded-2xl p-5 shadow-sm text-left hover:shadow-md transition-shadow border-2 ${detail?.id === s.id ? 'border-indigo-500' : 'border-transparent'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-900">{s.user.firstName}</p>
                  <p className="text-sm text-gray-500">{s.user.phone}</p>
                  {s.user.email && <p className="text-sm text-gray-400">{s.user.email}</p>}
                </div>
                <div className="text-right text-sm">
                  <span className="text-indigo-600 font-medium">{s._count.allocations} alloc.</span>
                  <span className="text-gray-400 ml-3">{s._count.beneficiaries} bénéf.</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">Inscrit le {new Date(s.createdAt).toLocaleDateString('fr-FR')}</p>
            </button>
          ))}
          {list.length === 0 && <div className="bg-white rounded-2xl p-8 text-center text-gray-500 shadow-sm">Aucun sponsor</div>}
        </div>
      </div>

      {detail && (
        <div className="w-96 bg-white rounded-2xl p-6 shadow-sm h-fit sticky top-0">
          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">{detail.user.firstName}</h2>
            <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          <p className="text-sm text-gray-500 mb-1">{detail.user.phone}</p>
          {detail.user.email && <p className="text-sm text-gray-400 mb-4">{detail.user.email}</p>}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-indigo-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-indigo-700">{detail.totalTransactions}</p>
              <p className="text-xs text-indigo-500">Transactions</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{detail.totalVolume.toFixed(0)} MAD</p>
              <p className="text-xs text-green-500">Volume total</p>
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Bénéficiaires ({detail.beneficiaries.length})</p>
          <div className="space-y-2 mb-4">
            {detail.beneficiaries.map((b: any) => (
              <div key={b.id} className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                <span>{b.user.firstName}</span>
                <span className="text-gray-400">{b.user.phone}</span>
              </div>
            ))}
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Allocations ({detail.allocations.length})</p>
          <div className="space-y-2">
            {detail.allocations.map((a: any) => (
              <div key={a.id} className="text-sm bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex justify-between">
                  <span className="font-medium">{a.category}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.status}</span>
                </div>
                <div className="text-gray-500 mt-1">{Number(a.remainingAmount).toFixed(0)} / {Number(a.limitAmount).toFixed(0)} MAD</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
