import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value:'FOOD',label:'Nourriture',icon:'🍕' },{ value:'HEALTH',label:'Santé',icon:'💊' },
  { value:'CLOTHES',label:'Vêtements',icon:'👗' },{ value:'EDUCATION',label:'Éducation',icon:'📚' },
  { value:'LEISURE',label:'Loisirs',icon:'🎮' },{ value:'GENERAL',label:'Général',icon:'💰' },
];

export function CreateEnvelopePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ beneficiaryId:'', category:'GENERAL', label:'', maxPerTransaction:'' });

  const { data: dashboard } = useQuery({
    queryKey: ['payer-dashboard'],
    queryFn: () => api.get('/api/dashboard/payer').then(r => r.data),
  });

  const create = useMutation({
    mutationFn: () => api.post('/api/envelopes', {
      ...form,
      maxPerTransaction: form.maxPerTransaction ? Number(form.maxPerTransaction) : undefined,
    }),
    onSuccess: () => { toast.success('Enveloppe créée !'); navigate('/payer'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erreur'),
  });

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <button onClick={() => navigate('/payer')} className="text-indigo-600 hover:underline text-sm">← Retour</button>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">Nouvelle enveloppe</h1>
      </div>
      <form onSubmit={e => { e.preventDefault(); create.mutate(); }} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bénéficiaire</label>
          <select required value={form.beneficiaryId} onChange={e => setForm(f => ({ ...f, beneficiaryId: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Sélectionner...</option>
            {(dashboard?.beneficiaries ?? []).map((b: any) => (
              <option key={b.userId} value={b.userId}>{b.email}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat.value} type="button" onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                className={`p-3 rounded-xl border-2 text-center transition ${form.category === cat.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="text-2xl">{cat.icon}</div>
                <div className="text-xs mt-1 font-medium">{cat.label}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'enveloppe</label>
          <input required value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ex: Cantine scolaire" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Plafond par transaction (MAD) <span className="text-gray-400">— optionnel</span></label>
          <input type="number" min="1" value={form.maxPerTransaction} onChange={e => setForm(f => ({ ...f, maxPerTransaction: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: 100" />
        </div>
        <button type="submit" disabled={create.isPending}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
          {create.isPending ? 'Création...' : "Créer l'enveloppe"}
        </button>
      </form>
    </div>
  );
}
