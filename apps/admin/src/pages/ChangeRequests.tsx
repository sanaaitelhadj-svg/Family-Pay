import React, { useEffect, useState } from 'react';
import { Edit2, Check, X, ChevronRight, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../api';

interface ChangeRequest {
  id: string; merchantId: string; status: string; reason?: string; createdAt: string;
  changes: Record<string, any>;
  merchant: { id: string; businessName: string; category: string; city: string };
}

const FIELD_LABELS: Record<string, string> = {
  businessName:'Nom du commerce', address:'Adresse', city:'Ville', phone:'Téléphone', email:'Email',
  registrationNumber:'N° RC', iceNumber:'ICE', taxId:'Identifiant fiscal', fiscalId:'Fiscal ID',
  cinRepresentant:'CIN Représentant', rib:'RIB', iban:'IBAN',
  contactAdmin:'Contact Administratif', contactFinance:'Contact Finance',
  contactOps:'Contact Opérations', contactLegal:'Contact Juridique',
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; Icon: React.ComponentType<any> }> = {
  PENDING:  { label: 'En attente', color: '#D97706', bg: '#FEF3C7', Icon: Clock },
  APPROVED: { label: 'Approuvé',   color: '#059669', bg: '#D1FAE5', Icon: CheckCircle2 },
  REJECTED: { label: 'Refusé',     color: '#DC2626', bg: '#FEE2E2', Icon: XCircle },
};

export default function ChangeRequestsPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL'|'PENDING'|'APPROVED'|'REJECTED'>('ALL');
  const [expanded, setExpanded] = useState<string|null>(null);
  const [rejectingId, setRejectingId] = useState<string|null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/merchants/change-requests-all');
      setRequests(res.data);
    } catch { setRequests([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    setSaving(true);
    try { await api.post(`/admin/merchants/change-requests/${id}/approve`); await load(); }
    catch(e: any) { alert(e?.response?.data?.error ?? 'Erreur'); }
    finally { setSaving(false); }
  };

  const reject = async (id: string) => {
    if (!rejectReason.trim()) { alert('Veuillez saisir un motif'); return; }
    setSaving(true);
    try { await api.post(`/admin/merchants/change-requests/${id}/reject`, { reason: rejectReason }); setRejectingId(null); setRejectReason(''); await load(); }
    catch(e: any) { alert(e?.response?.data?.error ?? 'Erreur'); }
    finally { setSaving(false); }
  };

  const filtered = filter === 'ALL' ? requests : requests.filter(r => r.status === filter);
  const counts = {
    ALL: requests.length,
    PENDING: requests.filter(r => r.status === 'PENDING').length,
    APPROVED: requests.filter(r => r.status === 'APPROVED').length,
    REJECTED: requests.filter(r => r.status === 'REJECTED').length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Demandes de modification</h1>
          <p className="text-sm text-gray-500 mt-0.5">Modifications soumises par les marchands</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium" style={{border:'1px solid #ECECF2', color:'#5B3DF5'}}>
          ↻ Actualiser
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(['ALL','PENDING','APPROVED','REJECTED'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={filter === f
              ? { background: '#5B3DF5', color: '#fff' }
              : { background: '#fff', color: '#6B7280', border: '1px solid #ECECF2' }}>
            {f === 'ALL' ? 'Toutes' : STATUS_CFG[f].label} ({counts[f]})
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
          <Edit2 size={32} strokeWidth={1.2}/>
          <p className="text-sm">Aucune demande{filter !== 'ALL' ? ' dans ce statut' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(cr => {
            const s = STATUS_CFG[cr.status] ?? STATUS_CFG['PENDING'];
            const isOpen = expanded === cr.id;
            return (
              <div key={cr.id} style={{background:'#fff', border: cr.status === 'PENDING' ? '1px solid #DDD6FE' : '1px solid #ECECF2'}} className="rounded-2xl overflow-hidden">
                {/* Row header */}
                <button onClick={() => setExpanded(isOpen ? null : cr.id)} className="w-full flex items-center gap-4 px-5 py-4 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-800">{cr.merchant.businessName}</span>
                      <span className="text-xs text-gray-400">— {cr.merchant.city}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{new Date(cr.createdAt).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                      <span className="text-xs text-gray-500">{Object.keys(cr.changes).length} champ{Object.keys(cr.changes).length > 1 ? 's' : ''} modifié{Object.keys(cr.changes).length > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{background: s.bg, color: s.color}}>
                      <s.Icon size={11}/>{s.label}
                    </span>
                    <ChevronRight size={14} className="text-gray-400 transition-transform" style={{transform: isOpen ? 'rotate(90deg)' : 'none'}}/>
                  </div>
                </button>

                {/* Expanded details */}
                {isOpen && (
                  <div style={{borderTop:'1px solid #F3F4F6'}} className="px-5 pb-4">
                    {/* Changes */}
                    <div className="grid grid-cols-1 gap-2 mt-3 mb-4">
                      {Object.entries(cr.changes).map(([k, v]) => (
                        <div key={k} className="rounded-xl p-3" style={{background:'#F8F8FC', border:'1px solid #ECECF2'}}>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{FIELD_LABELS[k] ?? k}</p>
                          {typeof v === 'object' && v !== null ? (
                            <div className="text-xs text-gray-700 space-y-0.5">
                              {Object.entries(v as Record<string,string>).map(([fk,fv]) => (
                                <p key={fk}><span className="text-gray-400">{fk}: </span><span className="font-medium">{String(fv)}</span></p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm font-medium text-gray-800">{String(v)}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Rejection reason if rejected */}
                    {cr.status === 'REJECTED' && cr.reason && (
                      <div className="mb-3 p-3 rounded-xl" style={{background:'#FEE2E2', border:'1px solid #FECACA'}}>
                        <p className="text-xs font-semibold text-red-600 mb-0.5">Motif du refus</p>
                        <p className="text-xs text-red-700">{cr.reason}</p>
                      </div>
                    )}

                    {/* Actions — only for PENDING */}
                    {cr.status === 'PENDING' && (
                      <>
                        {rejectingId === cr.id ? (
                          <div className="flex gap-2">
                            <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                              placeholder="Motif du refus..." className="flex-1 text-sm rounded-xl px-3 py-2 focus:outline-none"
                              style={{border:'1px solid #ECECF2'}} autoFocus/>
                            <button onClick={() => reject(cr.id)} disabled={saving}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{background:'#EF4444'}}>
                              <X size={13}/> Confirmer
                            </button>
                            <button onClick={() => { setRejectingId(null); setRejectReason(''); }}
                              className="px-3 py-2 rounded-xl text-sm text-gray-600" style={{border:'1px solid #ECECF2'}}>
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => approve(cr.id)} disabled={saving}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{background:'#22C55E'}}>
                              <Check size={14}/> Approuver les modifications
                            </button>
                            <button onClick={() => { setRejectingId(cr.id); setRejectReason(''); }}
                              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{background:'#EF4444'}}>
                              <X size={14}/> Refuser
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
