import { useState, useMemo } from 'react';
import { Plus, Trash2, CreditCard, CheckCircle2, Clock, Printer, X } from 'lucide-react';
import { fmt } from '../utils/format';
import { useMissions } from '../hooks/queries/useMissions';
import { useFactures, useCreateFacture, useDeleteFacture, useUpdateTranche } from '../hooks/queries/useFactures';
import Modal from '../components/ui/Modal';
import Field from '../components/ui/Field';
import { QueryCard } from '../components/ui/QueryState';
import type { ApiTranche } from '../services/factures.service';

// ── Helpers ──────────────────────────────────────────────────────────

function tva(ht: number, type: string) {
  const m = type === '18' ? Math.round(ht * 0.18) : 0;
  return { m, ttc: ht + m };
}

function nextNum(nums: string[]): string {
  const year = new Date().getFullYear();
  const max = nums
    .map(n => { const m = n.match(/(\d+)$/); return m ? parseInt(m[1]) : 0; })
    .reduce((a, b) => Math.max(a, b), 0);
  return `FAC-${year}-${String(max + 1).padStart(3, '0')}`;
}

function statutBadge(t: ApiTranche) {
  if (t.statut === 'Payé' || t.encaisse >= t.montant)
    return <span className="bdg bg" style={{ gap: 4, display: 'inline-flex', alignItems: 'center' }}><CheckCircle2 size={10} strokeWidth={2.5} />Soldé</span>;
  if (t.encaisse > 0)
    return <span className="bdg ba">Partiel</span>;
  const late = new Date(t.echeance) < new Date();
  return <span className={`bdg ${late ? 'br' : 'bn'}`} style={{ gap: 4, display: 'inline-flex', alignItems: 'center' }}>
    {late ? null : <Clock size={10} strokeWidth={2} />}{late ? 'En retard' : 'En attente'}
  </span>;
}

// ── Impression facture ────────────────────────────────────────────────

import type { ApiFacture } from '../services/factures.service';

function FacturePrint({ facture: f, onClose }: { facture: ApiFacture; onClose: () => void }) {
  const tvaMontant = f.tvaMontant ?? 0;
  const totalEnc   = f.tranches.reduce((s, t) => s + t.encaisse, 0);
  const solde      = f.ttc - totalEnc;

  return (
    <div className="fac-print-overlay">
      {/* Barre d'actions (masquée à l'impression) */}
      <div className="fac-print-bar">
        <button className="btn prim" onClick={() => window.print()}>
          <Printer size={14} strokeWidth={2} />Imprimer / Enregistrer en PDF
        </button>
        <button className="btn" onClick={onClose}>
          <X size={14} strokeWidth={2} />Fermer
        </button>
      </div>

      {/* Document A4 */}
      <div className="fac-print-doc">
        {/* ── En-tête ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48, borderBottom: '2px solid #18181b', paddingBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: '#18181b' }}>MARABU SERVICES</div>
            <div style={{ fontSize: 11, color: '#52525b', marginTop: 4 }}>Cabinet de conseil en management</div>
            <div style={{ fontSize: 11, color: '#52525b' }}>Abidjan, Côte d'Ivoire</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#18181b', letterSpacing: '-.03em' }}>FACTURE</div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#7c3aed', marginTop: 4 }}>{f.num}</div>
            <div style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>Date : {f.date.slice(0, 10)}</div>
          </div>
        </div>

        {/* ── Client ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#a1a1aa', marginBottom: 6 }}>Émetteur</div>
            <div style={{ fontWeight: 600 }}>Marabu Services</div>
            <div style={{ fontSize: 12, color: '#52525b' }}>Cabinet de conseil en management</div>
            <div style={{ fontSize: 12, color: '#52525b' }}>Abidjan, Côte d'Ivoire</div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#a1a1aa', marginBottom: 6 }}>Facturé à</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{f.mission.client}</div>
            <div style={{ fontSize: 12, color: '#52525b', marginTop: 2 }}>Mission : {f.mission.nom}</div>
          </div>
        </div>

        {/* ── Tableau prestations ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ background: '#18181b', color: '#fff' }}>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Désignation</th>
              <th style={{ padding: '9px 12px', textAlign: 'right', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', width: 90 }}>Qté</th>
              <th style={{ padding: '9px 12px', textAlign: 'right', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', width: 130 }}>Prix unitaire HT</th>
              <th style={{ padding: '9px 12px', textAlign: 'right', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', width: 130 }}>Montant HT</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e4e4e8' }}>
              <td style={{ padding: '12px 12px', fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>Prestation de conseil — {f.mission.nom}</div>
                <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>Mission : {f.mission.nom} · Client : {f.mission.client}</div>
              </td>
              <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12 }}>1</td>
              <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace' }}>{f.ht.toLocaleString('fr-FR')} FCFA</td>
              <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{f.ht.toLocaleString('fr-FR')} FCFA</td>
            </tr>
          </tbody>
        </table>

        {/* ── Totaux ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 36 }}>
          <div style={{ width: 280 }}>
            {[
              { lbl: 'Sous-total HT', val: f.ht, color: '#18181b' },
              ...(f.tvaType === '18' ? [{ lbl: 'TVA 18%', val: tvaMontant, color: '#52525b' }] : [{ lbl: 'TVA', val: null, color: '#52525b' }]),
            ].map(({ lbl, val, color }) => (
              <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #e4e4e8', fontSize: 12, color }}>
                <span>{lbl}</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {val !== null ? `${val.toLocaleString('fr-FR')} FCFA` : <span style={{ fontSize: 10, background: '#f4f4f5', padding: '1px 6px', borderRadius: 4 }}>Exonérée</span>}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 5px', fontSize: 15, fontWeight: 700, color: '#18181b' }}>
              <span>TOTAL TTC</span>
              <span style={{ fontFamily: 'monospace' }}>{f.ttc.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, color: totalEnc > 0 ? '#009950' : '#a1a1aa' }}>
              <span>Encaissé</span>
              <span style={{ fontFamily: 'monospace' }}>{totalEnc.toLocaleString('fr-FR')} FCFA</span>
            </div>
            {solde > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, fontWeight: 600, color: '#dc2626' }}>
                <span>Solde restant</span>
                <span style={{ fontFamily: 'monospace' }}>{solde.toLocaleString('fr-FR')} FCFA</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Échéancier ── */}
        {f.tranches.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#a1a1aa', marginBottom: 10 }}>Échéancier de paiement</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f4f4f5' }}>
                  {['Tranche', 'Montant (FCFA)', 'Échéance', 'Statut'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: h === 'Tranche' ? 'left' : 'right', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#71717a', borderBottom: '1px solid #e4e4e8' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {f.tranches.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f4f4f5' }}>
                    <td style={{ padding: '7px 10px', fontSize: 12 }}>Tranche {t.num}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{t.montant.toLocaleString('fr-FR')}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 12 }}>{t.echeance.slice(0, 10)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                        background: t.encaisse >= t.montant ? '#dcfce7' : '#fef3c7',
                        color: t.encaisse >= t.montant ? '#166534' : '#92400e',
                      }}>
                        {t.encaisse >= t.montant ? 'Soldé' : t.encaisse > 0 ? 'Partiel' : 'En attente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Mentions légales ── */}
        <div style={{ borderTop: '1px solid #e4e4e8', paddingTop: 20, fontSize: 11, color: '#71717a' }}>
          <div style={{ marginBottom: 6 }}>Paiement par virement bancaire à l'ordre de Marabu Services.</div>
          <div>En cas de retard de paiement, des pénalités de retard pourront être appliquées conformément à la législation en vigueur en Côte d'Ivoire.</div>
          <div style={{ marginTop: 16, textAlign: 'center', fontStyle: 'italic' }}>Merci de votre confiance.</div>
        </div>
      </div>
    </div>
  );
}

// ── Types locaux ─────────────────────────────────────────────────────

type TrancheLine = { montant: number; echeance: string };

const emptyTranche = (): TrancheLine => ({ montant: 0, echeance: '' });

// ── Page ─────────────────────────────────────────────────────────────

export default function Facturation() {
  const { data: factures = [], isLoading, error } = useFactures();
  const { data: missions = [] } = useMissions();
  const createMutation    = useCreateFacture();
  const deleteMutation    = useDeleteFacture();
  const trancheMutation   = useUpdateTranche();

  const [tab, setTab]         = useState<'factures' | 'echeancier'>('factures');
  const [modal, setModal]     = useState(false);
  const [tModal, setTModal]   = useState<{ factureId: number; tranche: ApiTranche } | null>(null);
  const [printFac, setPrintFac] = useState<ApiFacture | null>(null);
  const [filMis, setFilMis]   = useState('');

  // ── Formulaire nouvelle facture ──
  const [missionId, setMissionId]   = useState(0);
  const [num, setNum]               = useState('');
  const [date, setDate]             = useState('');
  const [ht, setHt]                 = useState(0);
  const [tvaType, setTvaType]       = useState<'exo' | '18'>('exo');
  const [tranches, setTranches]     = useState<TrancheLine[]>([emptyTranche(), emptyTranche()]);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  // ── Formulaire tranche ──
  const [tEnc, setTEnc]     = useState(0);
  const [tDate, setTDate]   = useState('');
  const [tRef, setTRef]     = useState('');
  const [tStatut, setTStatut] = useState('Payé');

  // ── KPIs ──
  const totalHT  = factures.reduce((s, f) => s + f.ht, 0);
  const totalTTC = factures.reduce((s, f) => s + f.ttc, 0);
  const totalEnc = factures.reduce((s, f) => f.tranches.reduce((a, t) => a + t.encaisse, 0) + s, 0);
  const solde    = totalTTC - totalEnc;

  // ── Échéancier (toutes tranches à plat) ──
  const allTranches = useMemo(() =>
    factures.flatMap(f =>
      f.tranches.map(t => ({ ...t, facNum: f.num, facId: f.id, misNom: f.mission.nom, client: f.mission.client }))
    ).sort((a, b) => new Date(a.echeance).getTime() - new Date(b.echeance).getTime()),
    [factures]
  );

  const filteredFac = filMis
    ? factures.filter(f => f.missionId === Number(filMis))
    : factures;

  // ── Helpers formulaire ──
  const { m: tvaMontant, ttc } = tva(ht, tvaType);

  function autoSplit() {
    if (!ttc || !tranches.length) return;
    const base = Math.floor(ttc / tranches.length);
    const rem  = ttc - base * tranches.length;
    setTranches(tranches.map((t, i) => ({ ...t, montant: base + (i === 0 ? rem : 0) })));
  }

  function setNbTranches(n: number) {
    setTranches(Array.from({ length: n }, (_, i) => tranches[i] ?? emptyTranche()));
  }

  function openNew() {
    setMissionId(0); setNum(nextNum(factures.map(f => f.num)));
    setDate(new Date().toISOString().slice(0, 10)); setHt(0);
    setTvaType('exo'); setTranches([emptyTranche(), emptyTranche()]);
    setErrors({}); setModal(true);
  }

  function openTranche(factureId: number, t: ApiTranche) {
    setTEnc(t.encaisse); setTDate(t.dateEnc?.slice(0, 10) ?? '');
    setTRef(t.ref ?? ''); setTStatut(t.encaisse >= t.montant ? 'Payé' : t.statut);
    setTModal({ factureId, tranche: t });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!missionId)             e.mission = 'Sélectionner une mission';
    if (!num.trim())            e.num = 'Numéro requis';
    if (!date)                  e.date = 'Date requise';
    if (ht <= 0)                e.ht = 'Montant requis';
    const total = tranches.reduce((s, t) => s + t.montant, 0);
    if (Math.abs(total - ttc) > 1) e.tranches = `Total tranches (${fmt(total)}) ≠ TTC (${fmt(ttc)})`;
    tranches.forEach((t, i) => { if (!t.echeance) e[`ech_${i}`] = 'Échéance requise'; });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    await createMutation.mutateAsync({ missionId, num, date, ht, tvaType, tranches });
    setModal(false);
  }

  async function saveTranche() {
    if (!tModal) return;
    await trancheMutation.mutateAsync({
      factureId: tModal.factureId, tid: tModal.tranche.id,
      data: { encaisse: tEnc, dateEnc: tDate || undefined, ref: tRef || undefined, statut: tStatut },
    });
    setTModal(null);
  }

  const missionOptions = missions.filter(m =>
    ['CONTRAT', 'EN_COURS', 'TERMINE'].includes(m.statut.toUpperCase())
  );

  return (
    <div className="pg">
      <div className="ph">
        <div className="ph-l">
          <h1>Facturation</h1>
          <p>Factures normalisées, tranches et suivi d'encaissement</p>
        </div>
        <div className="ph-r">
          <button className="btn prim" onClick={openNew}><Plus size={15} strokeWidth={2.5} />Nouvelle facture</button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kr">
        <div className="kpi b">
          <div className="kpi-l">Factures</div>
          <div className="kpi-v">{factures.length}</div>
          <div className="kpi-s">émises au total</div>
        </div>
        <div className="kpi a">
          <div className="kpi-l">Total HT</div>
          <div className="kpi-v">{fmt(totalHT)}</div>
          <div className="kpi-s">FCFA hors taxes</div>
        </div>
        <div className="kpi p">
          <div className="kpi-l">Total TTC</div>
          <div className="kpi-v">{fmt(totalTTC)}</div>
          <div className="kpi-s">FCFA toutes taxes</div>
        </div>
        <div className="kpi g">
          <div className="kpi-l">Encaissé</div>
          <div className="kpi-v">{fmt(totalEnc)}</div>
          <div className="kpi-s">FCFA reçus</div>
        </div>
        <div className={`kpi ${solde > 0 ? 'r' : 'g'}`}>
          <div className="kpi-l">Solde</div>
          <div className="kpi-v">{fmt(solde)}</div>
          <div className="kpi-s">FCFA restant à encaisser</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        <button className={`tab${tab === 'factures' ? ' on' : ''}`} onClick={() => setTab('factures')}>
          Factures émises
        </button>
        <button className={`tab${tab === 'echeancier' ? ' on' : ''}`} onClick={() => setTab('echeancier')}>
          Échéancier tranches
        </button>
      </div>

      {/* ── Tab Factures ── */}
      {tab === 'factures' && (
        <div className="card">
          <div className="ch fb">
            <h3>Factures émises</h3>
            <select className="sel" value={filMis} onChange={e => setFilMis(e.target.value)} style={{ width: 200 }}>
              <option value="">Toutes missions</option>
              {missionOptions.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </div>
          {isLoading || error
            ? <div className="cb"><QueryCard isLoading={isLoading} error={error} /></div>
            : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>N° Facture</th><th>Mission</th><th>Client</th><th>Date</th>
                      <th className="tr">HT</th><th className="tr">TVA</th><th className="tr">TTC</th>
                      <th className="tr">Encaissé</th><th>Progression</th><th>Statut</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFac.length === 0
                      ? <tr><td colSpan={11} className="empty">Aucune facture</td></tr>
                      : filteredFac.map(f => {
                        const enc  = f.tranches.reduce((s, t) => s + t.encaisse, 0);
                        const pct  = f.ttc > 0 ? Math.round(enc / f.ttc * 100) : 0;
                        const done = pct >= 100;
                        return (
                          <tr key={f.id}>
                            <td><span className="pc-num">{f.num}</span></td>
                            <td className="fw7">{f.mission.nom}</td>
                            <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{f.mission.client}</td>
                            <td style={{ fontSize: 11 }}>{f.date.slice(0, 10)}</td>
                            <td className="tnum">{fmt(f.ht)}</td>
                            <td className="tnum">{f.tvaType === '18' ? fmt(f.tvaMontant) : <span className="bdg bn">Exo</span>}</td>
                            <td className="tnum fw7">{fmt(f.ttc)}</td>
                            <td className="tnum tc">{fmt(enc)}</td>
                            <td style={{ minWidth: 100 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div className="prog" style={{ flex: 1 }}>
                                  <div className="prog-b" style={{ width: `${pct}%`, background: done ? 'var(--G)' : 'var(--A)' }} />
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--tx3)', flexShrink: 0 }}>{pct}%</span>
                              </div>
                            </td>
                            <td>
                              {done
                                ? <span className="bdg bg" style={{ gap: 4, display: 'inline-flex', alignItems: 'center' }}><CheckCircle2 size={10} strokeWidth={2.5} />Soldé</span>
                                : pct > 0
                                  ? <span className="bdg ba">Partiel</span>
                                  : <span className="bdg bn"><Clock size={10} strokeWidth={2} style={{ marginRight: 3 }} />En attente</span>
                              }
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <button className="ibt" title="Imprimer" onClick={() => setPrintFac(f)}>
                                <Printer size={13} strokeWidth={2} />
                              </button>
                              <button className="ibt del" title="Supprimer"
                                onClick={() => { if (confirm(`Supprimer la facture ${f.num} ?`)) deleteMutation.mutate(f.id); }}>
                                <Trash2 size={13} strokeWidth={2} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* ── Tab Échéancier ── */}
      {tab === 'echeancier' && (
        <div className="card">
          <div className="ch"><h3>Échéancier des tranches</h3></div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Mission</th><th>N° Facture</th><th>Tranche</th>
                  <th className="tr">Montant</th><th>Échéance</th>
                  <th className="tr">Encaissé</th><th>Date enc.</th><th>Réf.</th><th>Statut</th><th></th>
                </tr>
              </thead>
              <tbody>
                {allTranches.length === 0
                  ? <tr><td colSpan={10} className="empty">Aucune tranche</td></tr>
                  : allTranches.map(t => {
                    const late = t.encaisse < t.montant && new Date(t.echeance) < new Date();
                    return (
                      <tr key={t.id} style={late ? { background: 'var(--Rl)' } : undefined}>
                        <td className="fw7">{t.misNom}</td>
                        <td><span className="pc-num">{t.facNum}</span></td>
                        <td style={{ fontSize: 11 }}>Tranche {t.num}</td>
                        <td className="tnum">{fmt(t.montant)}</td>
                        <td style={{ fontSize: 11, color: late ? 'var(--R)' : undefined, fontWeight: late ? 700 : undefined }}>
                          {t.echeance.slice(0, 10)}
                        </td>
                        <td className="tnum tc">{t.encaisse > 0 ? fmt(t.encaisse) : '—'}</td>
                        <td style={{ fontSize: 11 }}>{t.dateEnc ? t.dateEnc.slice(0, 10) : '—'}</td>
                        <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{t.ref ?? '—'}</td>
                        <td>{statutBadge(t)}</td>
                        <td>
                          <button className="ibt" title="Saisir encaissement" onClick={() => openTranche(t.facId, t)}>
                            <CreditCard size={13} strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal Nouvelle Facture ── */}
      <Modal
        open={modal}
        title="Nouvelle facture"
        onClose={() => setModal(false)}
        onSave={save}
        saving={createMutation.isPending}
        saveLabel={createMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        width={740}
      >
        {/* Facture */}
        <div className="sep">Facture</div>
        <div className="fg" style={{ marginBottom: 16 }}>
          <div className="fr full">
            <label className="lbl">Mission *</label>
            <select className={`sel${errors.mission ? ' inp-err' : ''}`}
              value={missionId} onChange={e => { setMissionId(+e.target.value); setErrors(v => ({ ...v, mission: '' })); }}>
              <option value={0}>— Sélectionner —</option>
              {missionOptions.map(m => <option key={m.id} value={m.id}>{m.nom} — {m.client ?? ''}</option>)}
            </select>
            {errors.mission && <span style={{ fontSize: 10.5, color: 'var(--R)', marginTop: 2 }}>{errors.mission}</span>}
          </div>
          <Field label="N° Facture *" value={num} error={errors.num}
            onChange={e => setNum(e.target.value)} placeholder="FAC-2026-001" />
          <Field label="Date *" type="date" value={date} error={errors.date}
            onChange={e => setDate(e.target.value)} />
          <Field label="Montant HT (FCFA) *" type="number" value={ht} error={errors.ht}
            onChange={e => setHt(+e.target.value)} />
          <Field as="select" label="TVA" value={tvaType}
            onChange={e => setTvaType(e.target.value as 'exo' | '18')}>
            <option value="exo">Exonérée</option>
            <option value="18">18%</option>
          </Field>
          <div className="fr">
            <label className="lbl">Récap</label>
            <div style={{ background: 'var(--sur2)', border: '1px solid var(--bor)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 12 }}>
              {tvaType === '18' && <div style={{ color: 'var(--tx3)' }}>TVA 18% : <strong>{fmt(tvaMontant)} FCFA</strong></div>}
              <div>TTC : <strong style={{ color: 'var(--G)' }}>{fmt(ttc)} FCFA</strong></div>
            </div>
          </div>
        </div>

        {/* Tranches */}
        <div className="sep" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Tranches ({tranches.length})</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setNbTranches(n)}
                className="btn xs" style={{ padding: '2px 8px', background: tranches.length === n ? 'var(--G)' : undefined, color: tranches.length === n ? '#fff' : undefined, borderColor: tranches.length === n ? 'var(--G)' : undefined }}>
                {n}
              </button>
            ))}
            <button className="btn xs" onClick={autoSplit} style={{ marginLeft: 4 }}>Répartir</button>
          </div>
        </div>
        {errors.tranches && <div style={{ fontSize: 11, color: 'var(--R)', marginBottom: 8 }}>{errors.tranches}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tranches.map((t, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--sur2)', borderRadius: 'var(--r)', padding: '10px 12px', border: '1px solid var(--bor)' }}>
              <Field label={`Tranche ${i + 1} — Montant (FCFA)`} type="number" value={t.montant}
                onChange={e => setTranches(prev => prev.map((x, j) => j === i ? { ...x, montant: +e.target.value } : x))} />
              <Field label="Échéance *" type="date" value={t.echeance} error={errors[`ech_${i}`]}
                onChange={e => setTranches(prev => prev.map((x, j) => j === i ? { ...x, echeance: e.target.value } : x))} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--tx3)', textAlign: 'right' }}>
          Total tranches : <strong style={{ color: Math.abs(tranches.reduce((s, t) => s + t.montant, 0) - ttc) <= 1 ? 'var(--G)' : 'var(--R)' }}>
            {fmt(tranches.reduce((s, t) => s + t.montant, 0))} FCFA
          </strong>
        </div>
      </Modal>

      {/* ── Impression facture ── */}
      {printFac && <FacturePrint facture={printFac} onClose={() => setPrintFac(null)} />}

      {/* ── Modal Encaissement Tranche ── */}
      <Modal
        open={!!tModal}
        title={`Encaissement — Tranche ${tModal?.tranche.num ?? ''}`}
        onClose={() => setTModal(null)}
        onSave={saveTranche}
        saving={trancheMutation.isPending}
        saveLabel={trancheMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        width={480}
      >
        {tModal && (
          <div className="fg">
            <div className="fr full">
              <label className="lbl">Montant prévu</label>
              <div style={{ padding: '7px 10px', background: 'var(--sur2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700, border: '1px solid var(--bor)' }}>
                {fmt(tModal.tranche.montant)} FCFA
              </div>
            </div>
            <Field label="Montant encaissé (FCFA)" type="number" value={tEnc}
              onChange={e => setTEnc(+e.target.value)} />
            <Field as="select" label="Statut" value={tStatut} onChange={e => setTStatut(e.target.value)}>
              <option value="En attente">En attente</option>
              <option value="Partiellement payé">Partiellement payé</option>
              <option value="Payé">Payé</option>
            </Field>
            <Field label="Date d'encaissement" type="date" value={tDate} onChange={e => setTDate(e.target.value)} />
            <Field label="Référence / Virement" value={tRef} onChange={e => setTRef(e.target.value)} placeholder="VIR-2026-xxx" />
          </div>
        )}
      </Modal>
    </div>
  );
}
