import { useEffect, useState } from 'react';
import { api } from '../api';

interface Subscription {
  id: string;
  entityType: string;
  entityId: string;
  plan: string;
  amount: number;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
  SUSPENDED: 'bg-yellow-100 text-yellow-800',
};

const PLANS_FR: Record<string, string> = {
  MONTHLY: 'Mensuel',
  QUARTERLY: 'Trimestriel',
  BIANNUAL: 'Semestriel',
  ANNUAL: 'Annuel',
  CUSTOM: 'Personnalisé',
};

export default function Subscriptions() {
  const [list, setList] = useState<Subscription[]>([]);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    entityType: 'SPONSOR', entityId: '', plan: 'MONTHLY',
    amount: '', startDate: '', endDate: '', notes: '',
  });

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    if (typeFilter) params.set('entityType', typeFilter);
    api.get(`/admin/subscriptions?${params}`).then(r => setList(r.data)).finally(() => setLoading(false));
  }

  useEffect(load, [filter, typeFilter]);

  async function updateStatus(id: string, status: string) {
    await api.patch(`/admin/subscriptions/${id}`, { status });
    load();
  }

  async function createSubscription() {
    await api.post('/admin/subscriptions', {
      ...form,
      amount: Number(form.amount),
    });
    setShowForm(false);
    setForm({ entityType: 'SPONSOR', entityId: '', plan: 'MONTHLY', amount: '', startDate: '', endDate: '', notes: '' });
    load();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Abonnements</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700">
          + Nouvel abonnement
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">Créer un abonnement</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Type</label>
              <select value={form.entityType} onChange={e => setForm({...form, entityType: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <option value="SPONSOR">Sponsor</option>
                <option value="MERCHANT">Marchand</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">ID entité</label>
              <input value={form.entityId} onChange={e => setForm({...form, entityId: e.target.value})}
                placeholder="UUID sponsor ou marchand"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Plan</label>
              <select value={form.plan} onChange={e => setForm({...form, plan: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                {Object.entries(PLANS_FR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Montant (MAD)</label>
              <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                placeholder="29"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date début</label>
              <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date fin</label>
              <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div className="col-span-3">
              <label className="text-xs text-gray-500 block mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                placeholder="Notes optionnelles"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createSubscription}
              className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600">
              Créer
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(['', 'SPONSOR', 'MERCHANT'] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {t === '' ? 'Tous' : t === 'SPONSOR' ? 'Sponsors' : 'Marchands'}
          </button>
        ))}
        <div className="ml-4 flex gap-2">
          {(['', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium ${filter === s ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {s === '' ? 'Tous statuts' : s}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-gray-500">Chargement...</p> : (
        <div className="space-y-3">
          {list.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-500 shadow-sm">Aucun abonnement</div>
          ) : list.map(s => (
            <div key={s.id} className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.entityType === 'SPONSOR' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                    {s.entityType}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{PLANS_FR[s.plan] ?? s.plan}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[s.status] ?? ''}`}>{s.status}</span>
                </div>
                <p className="text-xs text-gray-400">ID : {s.entityId}</p>
                <p className="text-sm text-gray-600">
                  {new Date(s.startDate).toLocaleDateString('fr-FR')} → {new Date(s.endDate).toLocaleDateString('fr-FR')}
                </p>
                {s.notes && <p className="text-xs text-gray-400 italic">{s.notes}</p>}
              </div>
              <div className="flex items-center gap-4">
                <p className="text-xl font-bold text-indigo-700">{Number(s.amount).toFixed(2)} MAD</p>
                <div className="flex gap-2">
                  {s.status === 'ACTIVE' && (
                    <>
                      <button onClick={() => updateStatus(s.id, 'SUSPENDED')}
                        className="px-3 py-1.5 text-xs border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50">
                        Suspendre
                      </button>
                      <button onClick={() => updateStatus(s.id, 'CANCELLED')}
                        className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50">
                        Annuler
                      </button>
                    </>
                  )}
                  {s.status === 'SUSPENDED' && (
                    <button onClick={() => updateStatus(s.id, 'ACTIVE')}
                      className="px-3 py-1.5 text-xs border border-green-300 text-green-700 rounded-lg hover:bg-green-50">
                      Réactiver
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
