import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';
import toast from 'react-hot-toast';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

export function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/register', {
        ...form, role: 'PAYER', tenantId: TENANT_ID,
      });
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success('Compte créé !');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur inscription');
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof typeof form, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type} required
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">💳</div>
          <h1 className="text-2xl font-bold text-primary">Créer un compte</h1>
          <p className="text-gray-500 text-sm mt-1">Espace Payeur ALTIVAX Beta</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {field('firstName', 'Prénom', 'text', 'Ahmed')}
            {field('lastName', 'Nom', 'text', 'Benali')}
          </div>
          {field('email', 'Email', 'email', 'vous@exemple.ma')}
          {field('password', 'Mot de passe', 'password', '••••••••')}
          <button
            type="submit" disabled={loading}
            className="w-full bg-primary hover:bg-accent text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Création...' : "Créer mon compte"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Déjà inscrit ?{' '}
          <Link to="/login" className="text-accent font-medium hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
