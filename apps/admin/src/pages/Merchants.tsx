import { useEffect, useState } from 'react';
import { api } from '../api';

interface Contact { nom: string; phone: string; email?: string }

interface Merchant {
  id: string;
  businessName: string;
  city: string;
  address: string;
  category: string;
  kycStatus: string;
  registrationNumber: string | null;
  iceNumber: string | null;
  taxId: string | null;
  fiscalId: string | null;
  cinRepresentant: string | null;
  rib: string | null;
  attestationBancaire: boolean;
  gpsLat: number | null;
  gpsLng: number | null;
  photos: string[] | null;
  contactAdmin: Contact | null;
  contactFinance: Contact | null;
  contactOps: Contact | null;
  cguSignedAt: string | null;
  cguVersion: string | null;
  user: { firstName: string; phone: string; email: string | null };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_PSP: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

function Field({ label, value, required }: { label: string; value: string | null | undefined; required?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-medium ${value ? 'text-gray-900' : required ? 'text-red-400' : 'text-gray-400'}`}>
        {value || (required ? 'Non fourni' : '—')}
      </p>
    </div>
  );
}

function ContactBlock({ label, contact }: { label: string; contact: Contact | null }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2">{label}</p>
      {contact ? (
        <div className="space-y-1">
          <p className="text-sm text-gray-900">{contact.nom}</p>
          <p className="text-sm text-gray-500">{contact.phone}</p>
          {contact.email && <p className="text-sm text-gray-500">{contact.email}</p>}
        </div>
      ) : (
        <p className="text-sm text-red-400">Non fourni</p>
      )}
    </div>
  );
}

export default function Merchants() {
  const [list, setList] = useState<Merchant[]>([]);
  const [filter, setFilter] = useState('PENDING_PSP');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.get(`/admin/merchants?kycStatus=${filter}`).then(r => setList(r.data)).finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  async function approve(id: string) {
    await api.patch(`/admin/merchants/${id}/approve`);
    load();
  }

  async function reject(id: string) {
    const reason = prompt('Raison du rejet KYC :');
    if (!reason || reason.length < 5) return;
    await api.patch(`/admin/merchants/${id}/reject`, { reason });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Marchands KYC</h1>
      <div className="flex gap-2 mb-6">
        {(['PENDING_PSP', 'APPROVED', 'REJECTED'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${filter === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {s === 'PENDING_PSP' ? 'En attente' : s === 'APPROVED' ? 'Approuvés' : 'Rejetés'}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-500 shadow-sm">Aucun marchand</div>
      ) : (
        <div className="space-y-4">
          {list.map(m => (
            <div key={m.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">{m.businessName}</p>
                  <p className="text-sm text-gray-500">{m.city} · {m.category}</p>
                  <p className="text-sm text-gray-400">{m.user.phone}</p>
                  <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[m.kycStatus] ?? ''}`}>
                    {m.kycStatus}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                    className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
                    {expanded === m.id ? 'Masquer' : 'Voir dossier'}
                  </button>
                  {m.kycStatus === 'PENDING_PSP' && (
                    <>
                      <button onClick={() => approve(m.id)}
                        className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600">
                        Approuver
                      </button>
                      <button onClick={() => reject(m.id)}
                        className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600">
                        Rejeter
                      </button>
                    </>
                  )}
                </div>
              </div>
              {expanded === m.id && (
                <div className="border-t border-gray-100 px-6 py-5 bg-gray-50 space-y-5">

                  <section>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Légal</p>
                    <div className="grid grid-cols-3 gap-4">
                      <Field label="Registre de Commerce (RC)" value={m.registrationNumber} required />
                      <Field label="ICE" value={m.iceNumber} required />
                      <Field label="Patente (Tax ID)" value={m.taxId} required />
                      <Field label="Identifiant Fiscal (IF)" value={m.fiscalId} required />
                      <Field label="CIN Représentant" value={m.cinRepresentant} required />
                    </div>
                  </section>

                  <section>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Bancaire</p>
                    <div className="grid grid-cols-3 gap-4">
                      <Field label="RIB" value={m.rib} required />
                      <div>
                        <p className="text-xs text-gray-400">Attestation bancaire</p>
                        <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium mt-1 ${m.attestationBancaire ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {m.attestationBancaire ? 'Fournie' : 'Non fournie'}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Physique</p>
                    <div className="grid grid-cols-3 gap-4">
                      <Field label="Adresse réelle" value={m.address} />
                      <Field label="GPS" value={m.gpsLat && m.gpsLng ? `${m.gpsLat}, ${m.gpsLng}` : null} />
                      <div>
                        <p className="text-xs text-gray-400">Photos</p>
                        {m.photos && m.photos.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {m.photos.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noreferrer"
                                className="text-xs text-indigo-600 underline">Photo {i + 1}</a>
                            ))}
                          </div>
                        ) : <p className="text-sm text-gray-400">—</p>}
                      </div>
                    </div>
                  </section>

                  <section>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contacts</p>
                    <div className="grid grid-cols-3 gap-4">
                      <ContactBlock label="Responsable Admin" contact={m.contactAdmin} />
                      <ContactBlock label="Responsable Financier" contact={m.contactFinance} />
                      <ContactBlock label="Responsable Opérationnel" contact={m.contactOps} />
                    </div>
                  </section>

                  <section>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contractuel</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-400">Signature CGU partenaire</p>
                        <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium mt-1 ${m.cguSignedAt ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {m.cguSignedAt ? `Signé le ${new Date(m.cguSignedAt).toLocaleDateString('fr-FR')}` : 'Non signé'}
                        </span>
                      </div>
                      <Field label="Version CGU" value={m.cguVersion} />
                    </div>
                  </section>

                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
