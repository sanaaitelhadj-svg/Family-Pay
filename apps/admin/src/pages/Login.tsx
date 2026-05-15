import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function login() {
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/admin/login', { email, password });
      localStorage.setItem('admin_token', res.data.accessToken);
      navigate('/');
    } catch {
      setError('Identifiants invalides');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">FamilyPay Admin</h1>
        <p className="text-sm text-gray-500 mb-6">Connexion administrateur</p>
        <input
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          type="email"
          placeholder="admin@altivax.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
        />
        <button onClick={login} disabled={loading || !email || !password}
          className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
        {error && <p className="mt-3 text-sm text-red-500 text-center">{error}</p>}
      </div>
    </div>
  );
}
