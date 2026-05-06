import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { useAuthStore, UserRole } from '../../stores/auth.store';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const ROLES = [
  { value: 'PAYER', label: 'Payeur', icon: '👨‍👩‍👧', desc: 'Je gère le budget de ma famille', color: 'border-indigo-500 bg-indigo-50' },
  { value: 'BENEFICIARY', label: 'Bénéficiaire', icon: '👶', desc: 'Je reçois des paiements QR', color: 'border-emerald-500 bg-emerald-50' },
  { value: 'PARTNER', label: 'Partenaire', icon: '🏪', desc: 'Je suis un commerce partenaire', color: 'border-blue-500 bg-blue-50' },
];

const ROLE_HOME: Record<string, string> = {
  PAYER: '/payer',
  BENEFICIARY: '/beneficiary',
  PARTNER: '/partner',
};

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<string>('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/register', {
        ...form,
        role,
        tenantId: TENANT_ID,
      });
      setAuth(data.accessToken, data.user);
      toast.success('Compte créé avec succès !');
      navigate(ROLE_HOME[role] ?? '/');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const u = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [f]: e.target.value });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <span className="text-3xl">💳</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Créer un compte</h1>
          <p className="text-gray-400 text-sm mt-1">Étape {step}/2</p>
        </div>

        {/* Étape 1 : Choix du rôle */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-3">Je suis...</p>
            {ROLES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition text-left ${
                  role === r.value ? r.color : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">{r.icon}</span>
                <div>
                  <p className="font-semibold text-sm text-gray-800">{r.label}</p>
                  <p className="text-xs text-gray-500">{r.desc}</p>
                </div>
              </button>
            ))}
            <button
              disabled={!role}
              onClick={() => setStep(2)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition mt-2"
            >
              Continuer →
            </button>
          </div>
        )}

        {/* Étape 2 : Formulaire */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <button type="button" onClick={() => setStep(1)} className="text-xs text-indigo-600 mb-2 hover:underline">
              ← Changer de rôle
            </button>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prénom</label>
                <input type="text" required value={form.firstName} onChange={u('firstName')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
                <input type="text" required value={form.lastName} onChange={u('lastName')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={form.email} onChange={u('email')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
              <input type="tel" value={form.phone} onChange={u('phone')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="+212 6XX XX XX XX" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe</label>
              <input type="password" required minLength={8} value={form.password} onChange={u('password')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-4">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-indigo-600 font-medium hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
