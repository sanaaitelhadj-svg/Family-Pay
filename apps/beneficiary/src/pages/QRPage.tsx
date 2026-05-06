import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

const QR_TTL = 60; // seconds

interface Envelope {
  id: string;
  name: string;
  balance: string;
}

export function QRPage() {
  const [selectedEnvelope, setSelectedEnvelope] = useState<string>('');
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(QR_TTL);
  const [generating, setGenerating] = useState(false);

  const { data: envelopes } = useQuery<Envelope[]>({
    queryKey: ['envelopes'],
    queryFn: () => api.get('/api/envelopes').then((r) => r.data),
  });

  // Countdown timer
  useEffect(() => {
    if (!qrToken) return;
    setTimeLeft(QR_TTL);
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setQrToken(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [qrToken]);

  const generateQR = useCallback(async () => {
    setGenerating(true);
    try {
      const body: Record<string, string> = {};
      if (selectedEnvelope) body.envelopeId = selectedEnvelope;
      const { data } = await api.post('/api/qrcodes', body);
      setQrToken(data.token);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Impossible de générer le QR');
    } finally {
      setGenerating(false);
    }
  }, [selectedEnvelope]);

  // Progress bar color
  const pct = (timeLeft / QR_TTL) * 100;
  const barColor =
    timeLeft > 30 ? 'bg-emerald-500' : timeLeft > 10 ? 'bg-orange-400' : 'bg-red-500';
  const borderColor =
    timeLeft > 30
      ? 'border-emerald-400'
      : timeLeft > 10
      ? 'border-orange-400'
      : 'border-red-400';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Mon QR code de paiement</h1>
        <p className="text-sm text-gray-500 mt-1">
          Présentez ce QR code au payeur pour recevoir un paiement
        </p>
      </div>

      {/* Envelope selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Débiter sur (optionnel)
        </label>
        <select
          value={selectedEnvelope}
          onChange={(e) => setSelectedEnvelope(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Solde général</option>
          {envelopes?.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name} — {parseFloat(env.balance).toFixed(2)} MAD
            </option>
          ))}
        </select>
      </div>

      {/* QR display */}
      {qrToken ? (
        <div className="flex flex-col items-center">
          <div className={`p-4 bg-white rounded-2xl border-4 ${borderColor} shadow-lg transition-colors duration-300`}>
            <QRCodeSVG
              value={qrToken}
              size={220}
              level="M"
              includeMargin={false}
            />
          </div>

          {/* Countdown */}
          <div className="w-full mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Expire dans</span>
              <span className={timeLeft <= 10 ? 'text-red-500 font-semibold' : ''}>
                {timeLeft}s
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-1000 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <button
            onClick={generateQR}
            disabled={generating}
            className="mt-5 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-full text-sm font-medium transition"
          >
            🔄 Regénérer
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-56 h-56 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-5xl mb-2">📱</div>
              <p className="text-sm">Appuyez pour générer</p>
            </div>
          </div>
          <button
            onClick={generateQR}
            disabled={generating}
            className="mt-6 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold text-base transition shadow-md"
          >
            {generating ? 'Génération...' : 'Générer mon QR'}
          </button>
        </div>
      )}

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
        <strong>ℹ️ Comment ça marche :</strong> Le QR code est valable 60 secondes. Le payeur le
        scanne avec l'app Payeur pour effectuer le paiement.
      </div>
    </div>
  );
}
