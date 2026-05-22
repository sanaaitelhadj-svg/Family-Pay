import { useState } from 'react';
import { api } from '../api';

interface Props {
  endpoint: string;
  name: string;
  onClose: () => void;
}

export function PasswordResetModal({ endpoint, name, onClose }: Props) {
  const [pwd,     setPwd]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [done,    setDone]    = useState(false);

  const handleSubmit = async () => {
    if (pwd.length < 6)    { setError('Minimum 6 caractères'); return; }
    if (pwd !== confirm)   { setError('Les mots de passe ne correspondent pas'); return; }
    setSaving(true); setError('');
    try {
      await api.patch(endpoint, { newPassword: pwd });
      setDone(true);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Erreur inconnue');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Réinitialiser le mot de passe</h2>
        <p className="text-sm text-gray-500 mb-4">{name}</p>

        {done ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-green-600 text-xl">✓</span>
            </div>
            <p className="text-green-700 font-medium mb-4">Mot de passe modifié avec succès</p>
            <button onClick={onClose}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nouveau mot de passe</label>
                <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Min. 6 caractères" autoFocus />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Confirmer le mot de passe</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Répéter le mot de passe" />
              </div>
            </div>
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={onClose}
                className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
