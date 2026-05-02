import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function HomePage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-900 to-violet-700 flex items-center justify-center">
      <div className="text-center text-white p-8">
        <h1 className="text-4xl font-bold mb-2">ALTIVAX</h1>
        <h2 className="text-2xl font-semibold text-violet-300 mb-6">FamilyPay</h2>
        <p className="text-lg text-violet-200 mb-2">{t('app.partner.title')}</p>
        <p className="text-sm text-violet-400">{t('app.partner.subtitle')}</p>
        <div className="mt-8 px-4 py-2 bg-violet-600 rounded-lg text-sm text-violet-100">
          Sprint 0a — Infrastructure ✅
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
