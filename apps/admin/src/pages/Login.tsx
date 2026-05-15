import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function sendOtp() {
    setLoading(true); setError('');
    try {
      await api.post('/auth/otp/send', { phone });
      setStep('otp');
    } catch {
      setError('Numéro invalide ou erreur réseau');
    } finally { setLoading(false); }
  }

  async function verify() {
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/otp/verify', { phone, code });
      if (res.data.user.role !== 'ADMIN') {
        setError('Accès réservé aux administrateurs');
        return;
      }
      localStorage.setItem('admin_token', res.data.accessToken);
      navigate('/');
    } catch {
      setError('Code invalide');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">FamilyPay Admin</h1>
        <p className="text-sm text-gray-500 mb-6">Connexion administrateur</p>
        {step === 'phone' ? (
          <>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="+212 6XX XXX XXX"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <button onClick={sendOtp} disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Envoi...' : 'Envoyer le code'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">Code envoyé au {phone}</p>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-center tracking-widest mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value)}
            />
            <button onClick={verify} disabled={loading || code.length !== 6}
              className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Vérification...' : 'Valider'}
            </button>
          </>
        )}
        {error && <p className="mt-3 text-sm text-red-500 text-center">{error}</p>}
      </div>
    </div>
  );
}
