import { useState, useEffect } from 'react';
import { api } from '../api';

interface SubscriptionPlan {
  id: string; name: string; description: string | null;
  price: string; durationMonths: number; features: string[] | null; isActive: boolean; createdAt: string;
}
interface Subscription {
  id: string; entityType: string; entityId: string;
  planId: string | null; subscriptionPlan: { name: string; price: string } | null;
  amount: string; startDate: string | null; endDate: string | null; status: string; createdAt: string;
}
interface PlanForm { name: string; description: string; price: string; durationMonths: string; features: string; }
const EMPTY_PLAN: PlanForm = { name: '', description: '', price: '', durationMonths: '', features: '' };
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800', SUSPENDED: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-red-100 text-red-800', EXPIRED: 'bg-gray-100 text-gray-700',
};

export default function Subscriptions() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [planModal, setPlanModal] = useState<'create' | 'edit' | null>(null);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(EMPTY_PLAN);
  const [planSaving, setPlanSaving] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadPlans = async () => {
    setPlansLoading(true);
    try { const res = await api.get('/admin/subscription-plans'); setPlans(res.data); }
    finally { setPlansLoading(false); }
  };
  const loadSubscriptions = async () => {
    setSubsLoading(true);
    try { const res = await api.get('/admin/subscriptions'); setSubscriptions(res.data); }
    finally { setSubsLoading(false); }
  };
  useEffect(() => { loadPlans(); loadSubscriptions(); }, []);

  const openCreatePlan = () => { setPlanForm(EMPTY_PLAN); setEditingPlan(null); setPlanModal('create'); };
  const openEditPlan = (plan: SubscriptionPlan) => {
    setPlanForm({
      name: plan.name, description: plan.description ?? '', price: plan.price,
      durationMonths: String(plan.durationMonths),
      features: Array.isArray(plan.features) ? plan.features.join(', ') : '',
    });
    setEditingPlan(plan); setPlanModal('edit');
  };
  const savePlan = async () => {
    if (!planForm.name || !planForm.price || !planForm.durationMonths) return;
    setPlanSaving(true);
    try {
      const body = {
        name: planForm.name, description: planForm.description || undefined,
        price: parseFloat(planForm.price), durationMonths: parseInt(planForm.durationMonths),
        features: planForm.features ? planForm.features.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      };
      if (planModal === 'create') await api.post('/admin/subscription-plans', body);
      else if (editingPlan) await api.patch(`/admin/subscription-plans/${editingPlan.id}`, body);
      setPlanModal(null); await loadPlans();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erreur');
    } finally { setPlanSaving(false); }
  };
  const togglePlanActive = async (plan: SubscriptionPlan) => {
    await api.patch(`/admin/subscription-plans/${plan.id}`, { isActive: !plan.isActive });
    await loadPlans();
  };

  const updateSubStatus = async (id: string, status: string) => {
    await api.patch(`/admin/subscriptions/${id}`, { status });
    await loadSubscriptions();
  };

  const filteredSubs = subscriptions.filter(s => {
    if (entityFilter !== 'ALL' && s.entityType !== entityFilter) return false;
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-10">

      {/* ── Catalogue des offres ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Catalogue des offres</h2>
            <p className="text-sm text-gray-500">Plans d'abonnement proposés aux marchands</p>
          </div>
          <button onClick={openCreatePlan}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Nouvelle offre
          </button>
        </div>

        {plansLoading ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">Chargement...</div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-gray-400 mb-2">Aucune offre définie</p>
            <button onClick={openCreatePlan} className="text-indigo-600 text-sm hover:underline">Créer la première offre →</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map(plan => (
              <div key={plan.id} className={`bg-white rounded-xl shadow p-5 space-y-3 ${!plan.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                    {plan.description && <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {plan.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">MAD / {plan.durationMonths} mois</span>
                </div>
                {Array.isArray(plan.features) && plan.features.length > 0 && (
                  <ul className="space-y-1">
                    {(plan.features as string[]).map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span className="text-green-500">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => openEditPlan(plan)}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50">Modifier</button>
                  <button onClick={() => togglePlanActive(plan)}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-medium ${plan.isActive ? 'bg-orange-50 text-orange-700 hover:bg-orange-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                    {plan.isActive ? 'Désactiver' : 'Activer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Abonnements actifs ───────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Abonnements</h2>
            <p className="text-sm text-gray-500">{filteredSubs.length} abonnement{filteredSubs.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm">
              <option value="ALL">Tous les types</option>
              <option value="MERCHANT">Marchands</option>
              <option value="SPONSOR">Sponsors</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm">
              <option value="ALL">Tous les statuts</option>
              <option value="ACTIVE">Actif</option>
              <option value="SUSPENDED">Suspendu</option>
              <option value="CANCELLED">Annulé</option>
              <option value="EXPIRED">Expiré</option>
            </select>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {subsLoading ? (
            <div className="p-8 text-center text-gray-400">Chargement...</div>
          ) : filteredSubs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Aucun abonnement</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Type','Entité','Offre','Début','Fin','Statut','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSubs.map(sub => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sub.entityType === 'MERCHANT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {sub.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">{sub.entityId.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-gray-900">
                      {sub.subscriptionPlan?.name ?? '—'}
                      {sub.subscriptionPlan?.price && <span className="text-xs text-gray-500 ml-1">({sub.subscriptionPlan.price} MAD)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{sub.startDate ? new Date(sub.startDate).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{sub.endDate ? new Date(sub.endDate).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[sub.status] ?? 'bg-gray-100 text-gray-600'}`}>{sub.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {sub.status === 'ACTIVE' && (
                          <button onClick={() => updateSubStatus(sub.id, 'SUSPENDED')}
                            className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200">Suspendre</button>
                        )}
                        {sub.status === 'SUSPENDED' && (
                          <button onClick={() => updateSubStatus(sub.id, 'ACTIVE')}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">Réactiver</button>
                        )}
                        {(sub.status === 'ACTIVE' || sub.status === 'SUSPENDED') && (
                          <button onClick={() => updateSubStatus(sub.id, 'CANCELLED')}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">Annuler</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Plan Modal ───────────────────────────────────────────────────── */}
      {planModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              {planModal === 'create' ? 'Nouvelle offre' : `Modifier — ${editingPlan?.name}`}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input type="text" placeholder="Offre Starter, Pack Premium..."
                  value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={2} value={planForm.description}
                  onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix (MAD) *</label>
                  <input type="number" min="0" step="0.01" placeholder="299"
                    value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durée (mois) *</label>
                  <input type="number" min="1" step="1" placeholder="12"
                    value={planForm.durationMonths} onChange={e => setPlanForm(f => ({ ...f, durationMonths: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inclus <span className="text-gray-400 font-normal">(séparés par virgule)</span></label>
                <input type="text" placeholder="Support prioritaire, Accès API, Rapports mensuels"
                  value={planForm.features} onChange={e => setPlanForm(f => ({ ...f, features: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setPlanModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={savePlan}
                disabled={planSaving || !planForm.name || !planForm.price || !planForm.durationMonths}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {planSaving ? 'Enregistrement...' : planModal === 'create' ? 'Créer' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
