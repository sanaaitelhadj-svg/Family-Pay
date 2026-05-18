import { useEffect, useState } from 'react';
import { api } from '../api';

interface Contact { nom: string; phone: string; email?: string }
interface DayHours { open: string; close: string; closed?: boolean }

interface Merchant {
  id: string;
  businessName: string;
  city: string;
  address: string;
  category: string;
  kycStatus: string;
  contractUrl: string | null;
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
  contactLegal: Contact | null;
  riskLevel: string | null;
  allowedProducts: string[] | null;
  businessHours: Record<string, DayHours> | null;
  commissionType: string;
  commissionRate: string | null;
  cguSignedAt: string | null;
  cguVersion: string | null;
  cguClauses: string[] | null;
  user: { firstName: string; phone: string; email: string | null };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_PSP: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const RISK_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-red-100 text-red-800',
};

const DAYS_FR: Record<string, string> = {
  monday: 'Lun', tuesday: 'Mar', wednesday: 'Mer', thursday: 'Jeu',
  friday: 'Ven', saturday: 'Sam', sunday: 'Dim',
};

const CGU_LABELS: Record<string, string> = {
  no_fake_transactions: 'Pas de fausses transactions',
  no_cash_exchange: 'Pas d\'échange en espèces',
  no_fake_refunds: 'Pas de remboursements abusifs',
  no_allocation_to_cash: 'Pas de conversion allocation→cash',
  audit_rights: 'Droits d\'audit acceptés',
  suspension_rights: 'Droits de suspension acceptés',
};

const COMMISSION_TYPES = [
  { value: 'TRANSACTION_PERCENTAGE', label: '% par transaction' },
  { value: 'SUBSCRIPTION_MONTHLY', label: 'Abonnement mensuel' },
  { value: 'SUBSCRIPTION_QUARTERLY', label: 'Abonnement trimestriel' },
  { value: 'SUBSCRIPTION_BIANNUAL', label: 'Abonnement semestriel' },
  { value: 'SUBSCRIPTION_ANNUAL', label: 'Abonnement annuel' },
];

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
  const [commissionEdit, setCommissionEdit] = useState<Record<string, { type: string; rate: string }>>({});
  const [contractEdit, setContractEdit] = useState<Record<string, string>>({});

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

  async function saveCommission(id: string) {
    const edit = commissionEdit[id];
    if (!edit) return;
    await api.patch(`/admin/merchants/${id}/commission`, {
      commissionType: edit.type,
      commissionRate: parseFloat(edit.rate),
    });
    load();
  }

  async function saveContract(id: string) {
    const url = contractEdit[id];
    if (!url) return;
    await api.patch(`/admin/merchants/${id}/contract`, { contractUrl: url });
    load();
  }

  function initCommissionEdit(m: Merchant) {
    if (!commissionEdit[m.id]) {
      setCommissionEdit(prev => ({ ...prev, [m.id]: { type: m.commissionType, rate: m.commissionRate ?? '' } }));
    }
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
                  <div className="flex gap-2 flex-wrap">
                    <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[m.kycStatus] ?? ''}`}>
                      {m.kycStatus}
                    </span>
                    {m.riskLevel && (
                      <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${RISK_COLORS[m.riskLevel] ?? ''}`}>
                        Risque {m.riskLevel}
                      </span>
                    )}
                    {m.commissionRate && (
                      <span className="inline-block text-xs px-2 py-1 rounded-full font-medium bg-indigo-100 text-indigo-700">
                        {m.commissionType === 'TRANSACTION_PERCENTAGE'
                          ? `${(parseFloat(m.commissionRate) * 100).toFixed(2)}% / tx`
                          : COMMISSION_TYPES.find(t => t.value === m.commissionType)?.label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setExpanded(expanded === m.id ? null : m.id); initCommissionEdit(m); }}
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
                <div className="border-t border-gray-100 px-6 py-5 bg-gray-50 space-y-6">

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
                    {m.businessHours && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-400 mb-2">Horaires d'ouverture</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(m.businessHours).map(([day, h]) => (
                            <div key={day} className={`text-xs px-3 py-1 rounded-lg ${h.closed ? 'bg-gray-100 text-gray-400' : 'bg-indigo-50 text-indigo-700'}`}>
                              <span className="font-medium">{DAYS_FR[day] ?? day}</span>
                              {!h.closed && <span className="ml-1">{h.open}–{h.close}</span>}
                              {h.closed && <span className="ml-1">Fermé</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <section>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Business</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-400">Niveau de risque</p>
                        {m.riskLevel ? (
                          <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium mt-1 ${RISK_COLORS[m.riskLevel]}`}>
                            {m.riskLevel}
                          </span>
                        ) : <p className="text-sm text-gray-400">—</p>}
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-400">Produits/services autorisés</p>
                        {m.allowedProducts && m.allowedProducts.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {m.allowedProducts.map((p, i) => (
                              <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">{p}</span>
                            ))}
                          </div>
                        ) : <p className="text-sm text-gray-400">—</p>}
                      </div>
                    </div>
                  </section>

                  <section>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contacts</p>
                    <div className="grid grid-cols-4 gap-4">
                      <ContactBlock label="Responsable Admin" contact={m.contactAdmin} />
                      <ContactBlock label="Responsable Financier" contact={m.contactFinance} />
                      <ContactBlock label="Responsable Juridique" contact={m.contactLegal} />
                      <ContactBlock label="Responsable Opérationnel" contact={m.contactOps} />
                    </div>
                  </section>

                  <section>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contractuel</p>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-400">Signature CGU partenaire</p>
                        <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium mt-1 ${m.cguSignedAt ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {m.cguSignedAt ? `Signé le ${new Date(m.cguSignedAt).toLocaleDateString('fr-FR')}` : 'Non signé'}
                        </span>
                      </div>
                      <Field label="Version CGU" value={m.cguVersion} />
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Clauses acceptées</p>
                        {m.cguClauses && m.cguClauses.length > 0 ? (
                          <div className="space-y-1">
                            {m.cguClauses.map((c, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <span className="text-green-500 text-xs">✓</span>
                                <span className="text-xs text-gray-700">{CGU_LABELS[c] ?? c}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-sm text-gray-400">—</p>}
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-3">Contrat électronique</p>
                      {m.contractUrl ? (
                        <div className="flex items-center gap-3">
                          <a href={m.contractUrl} target="_blank" rel="noreferrer"
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
                            Télécharger le contrat
                          </a>
                          <button onClick={() => setContractEdit(prev => ({ ...prev, [m.id]: m.contractUrl ?? '' }))}
                            className="text-xs text-gray-400 underline">Modifier l'URL</button>
                        </div>
                      ) : (
                        <p className="text-sm text-red-400 mb-2">Aucun contrat défini</p>
                      )}
                      {(contractEdit[m.id] !== undefined || !m.contractUrl) && (
                        <div className="flex gap-2 mt-2">
                          <input
                            value={contractEdit[m.id] ?? ''}
                            onChange={e => setContractEdit(prev => ({ ...prev, [m.id]: e.target.value }))}
                            placeholder="https://... URL du contrat PDF"
                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                          />
                          <button onClick={() => saveContract(m.id)}
                            className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600">
                            Enregistrer
                          </button>
                        </div>
                      )}
                    </div>
                  </section>

                  <section>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Commission & Facturation</p>
                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Type de commission</p>
                          <select
                            value={commissionEdit[m.id]?.type ?? m.commissionType}
                            onChange={e => setCommissionEdit(prev => ({ ...prev, [m.id]: { ...prev[m.id], type: e.target.value } }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                            {COMMISSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">
                            {(commissionEdit[m.id]?.type ?? m.commissionType) === 'TRANSACTION_PERCENTAGE'
                              ? 'Taux (ex: 0.015 = 1.5%)'
                              : 'Montant (MAD)'}
                          </p>
                          <input
                            type="number"
                            step="0.001"
                            value={commissionEdit[m.id]?.rate ?? m.commissionRate ?? ''}
                            onChange={e => setCommissionEdit(prev => ({ ...prev, [m.id]: { ...prev[m.id], rate: e.target.value } }))}
                            placeholder={m.commissionType === 'TRANSACTION_PERCENTAGE' ? '0.015' : '99'}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="flex items-end">
                          <button onClick={() => saveCommission(m.id)}
                            className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700">
                            Enregistrer
                          </button>
                        </div>
                      </div>
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
