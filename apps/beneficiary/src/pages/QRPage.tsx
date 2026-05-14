import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

const CATEGORY_ICONS: Record<string, string> = {
  FOOD: '🍕', HEALTH: '💊', CLOTHES: '👗',
  EDUCATION: '📚', LEISURE: '🎮', GENERAL: '💰',
};

const QR_TTL = 60;

export function QRPage() {
  const [selectedEnvelope, setSelectedEnvelope] = useState<any>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get('/api/wallets/me').then(r => r.data),
  });

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) { setQrToken(null); return; }
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  const generateQR = useCallback(async () => {
    if (!selectedEnvelope) { toast.error('Sélectionne une enveloppe'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/api/qrcodes', { envelopeId: selectedEnvelope.id });
      setQrToken(data.token);
      setTimeLeft(QR_TTL);
      toast.success('QR Code généré — valide 60 secondes');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Erreur génération QR');
    } finally {
      setLoading(false);
    }
  }, [selectedEnvelope]);

  const timerColor = timeLeft > 30 ? 'text-emerald-600' : timeLeft > 10 ? 'text-orange-500' : 'text-red-600';
  const timerBg = timeLeft > 30 ? 'bg-emerald-100' : timeLeft > 10 ? 'bg-orange-100' : 'bg-red-100';

  return (
    <div className="space-y-4 py-2">
      <h2 className="text-xl font-bold text-gray-800">Mon QR Code de paiement</h2>

      {/* Envelope selector */}
      <div>
        <p className="text-sm font-medium text-gray-600 mb-2">Choisir une enveloppe</p>
        <div className="space-y-2">
          {wallet?.envelopes?.map((env: any) => (
            <button key={env.id} onClick={() => { setSelectedEnvelope(env); setQrToken(null); }}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition ${
                selectedEnvelope?.id === env.id
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 bg-white hover:border-emerald-300'
              }`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{CATEGORY_ICONS[env.category] ?? '💰'}</span>
                <span className="font-medium text-gray-800">{env.label}</span>
              </div>
              <span className={`font-bold ${Number(env.balance) > 0 ? 'text-emerald-700' : 'text-red-500'}`}>
                {Number(env.balance).toFixed(2)} MAD
              </span>
            </button>
          ))}
          {!wallet?.envelopes?.length && (
            <p className="text-center text-gray-400 py-4 bg-white rounded-xl">
              Aucune enveloppe disponible
            </p>
          )}
        </div>
      </div>

      {/* Generate button */}
      {selectedEnvelope && !qrToken && (
        <button onClick={generateQR} disabled={loading || Number(selectedEnvelope.balance) <= 0}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl text-lg shadow transition disabled:opacity-50">
          {loading ? 'Génération...' : `📱 Générer QR — ${selectedEnvelope.label}`}
        </button>
      )}

      {/* QR Code display */}
      {qrToken && timeLeft > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className={`inline-block px-4 py-1 rounded-full text-sm font-bold mb-4 ${timerBg} ${timerColor}`}>
            ⏱ {timeLeft}s restantes
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-5">
            <div
              className={`h-2 rounded-full transition-all ${timeLeft > 30 ? 'bg-emerald-500' : timeLeft > 10 ? 'bg-orange-500' : 'bg-red-500'}`}
              style={{ width: `${(timeLeft / QR_TTL) * 100}%` }}
            />
          </div>

          <div className="flex justify-center mb-4 p-3 bg-gray-50 rounded-xl inline-block">
            <QRCodeSVG value={qrToken} size={220} level="H"
              imageSettings={{ src: '', height: 0, width: 0, excavate: false }} />
          </div>

          <div className="bg-emerald-50 rounded-xl p-3">
            <p className="text-emerald-700 font-semibold">{selectedEnvelope.label}</p>
            <p className="text-2xl font-bold text-emerald-800">{Number(selectedEnvelope.balance).toFixed(2)} MAD</p>
            <p className="text-xs text-emerald-600 mt-1">Max {Number(selectedEnvelope.maxPerTransaction).toFixed(0)} MAD par transaction</p>
          </div>

          <button onClick={generateQR} disabled={loading}
            className="mt-4 w-full border-2 border-emerald-500 text-emerald-700 font-semibold py-2 rounded-xl hover:bg-emerald-50 transition">
            🔄 Nouveau QR
          </button>
        </div>
      )}

      {/* Expired state */}
      {selectedEnvelope && qrToken === null && timeLeft === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-2">⏰</div>
          <p className="font-semibold text-red-700">QR Code expiré</p>
          <button onClick={generateQR} disabled={loading}
            className="mt-3 bg-emerald-600 text-white font-semibold px-6 py-2 rounded-xl hover:bg-emerald-700 transition">
            Générer un nouveau QR
          </button>
        </div>
      )}
    </div>
  );
}
