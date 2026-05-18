import { useState, useMemo } from 'react';
import { Plus, Trash2, CreditCard, CheckCircle2, Clock, Printer, Loader2 } from 'lucide-react';
import { fmt } from '../utils/format';
import { useMissions } from '../hooks/queries/useMissions';
import { useFactures, useCreateFacture, useDeleteFacture, useUpdateTranche } from '../hooks/queries/useFactures';
import Modal from '../components/ui/Modal';
import Field from '../components/ui/Field';
import { QueryCard } from '../components/ui/QueryState';
import { openFacturePdf } from '../components/pdf/FacturePdf';
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

import type { ApiFacture } from '../services/factures.service';

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

  const [tab, setTab]           = useState<'factures' | 'echeancier'>('factures');
  const [modal, setModal]       = useState(false);
  const [tModal, setTModal]     = useState<{ factureId: number; tranche: ApiTranche } | null>(null);
  const [pdfLoading, setPdfLoading] = useState<number | null>(null);
  const [filMis, setFilMis]     = useState('');

  async function printFacture(f: ApiFacture) {
    setPdfLoading(f.id);
    try { await openFacturePdf(f); }
    finally { setPdfLoading(null); }
  }

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

  // Must be declared before any function that uses it
  const missionOptions = missions.filter(m =>
    ['CONTRAT', 'EN_COURS', 'TERMINE'].includes(m.statut.toUpperCase())
  );

  // Info on selected mission's billing status
  const selectedMission = missionId ? missionOptions.find(m => m.id === missionId) : null;
  const alreadyBilledHT = missionId
    ? factures.filter(f => f.missionId === missionId).reduce((s, f) => s + f.ht, 0)
    : 0;
  const remainingHT = selectedMission ? Math.max(0, selectedMission.montant - alreadyBilledHT) : 0;
  const isOverBilling = selectedMission != null && ht > remainingHT && remainingHT > 0;

  // When a mission is selected: auto-fill remaining amount to bill and TVA
  function onSelectMission(id: number) {
    setMissionId(id);
    setErrors(v => ({ ...v, mission: '' }));
    if (!id) { setHt(0); return; }
    const mission = missionOptions.find(m => m.id === id);
    if (!mission) return;
    const billed = factures.filter(f => f.missionId === id).reduce((s, f) => s + f.ht, 0);
    setHt(Math.max(0, mission.montant - billed));
    setTvaType((mission.tva ?? 'exo') as 'exo' | '18');
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
    if (selectedMission && ht > selectedMission.montant)
      e.ht = `Dépasse le montant contractuel (${fmt(selectedMission.montant)} FCFA)`;
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
                              <button
                                className="ibt"
                                title="Générer PDF"
                                disabled={pdfLoading === f.id}
                                onClick={() => printFacture(f)}
                              >
                                {pdfLoading === f.id
                                  ? <Loader2 size={13} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
                                  : <Printer size={13} strokeWidth={2} />
                                }
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
              value={missionId} onChange={e => onSelectMission(+e.target.value)}>
              <option value={0}>— Sélectionner —</option>
              {missionOptions.map(m => <option key={m.id} value={m.id}>{m.nom} — {m.client ?? ''}</option>)}
            </select>
            {errors.mission && <span style={{ fontSize: 10.5, color: 'var(--R)', marginTop: 2 }}>{errors.mission}</span>}
          </div>

          {/* Info mission sélectionnée */}
          {selectedMission && (
            <div className="fr full">
              <div style={{
                background: 'var(--sur2)', border: `1px solid ${isOverBilling ? 'var(--A)' : 'var(--bor)'}`,
                borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 12,
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px',
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Montant contractuel</div>
                  <div className="fw7" style={{ fontFamily: 'var(--fm)', color: 'var(--tx1)' }}>{fmt(selectedMission.montant)} FCFA</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Déjà facturé</div>
                  <div className="fw7" style={{ fontFamily: 'var(--fm)', color: alreadyBilledHT > 0 ? 'var(--A)' : 'var(--tx3)' }}>{fmt(alreadyBilledHT)} FCFA</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Restant à facturer</div>
                  <div className="fw7" style={{ fontFamily: 'var(--fm)', color: remainingHT > 0 ? 'var(--G)' : 'var(--tx3)' }}>{fmt(remainingHT)} FCFA</div>
                </div>
              </div>
              {isOverBilling && (
                <div className="alert a" style={{ marginTop: 4, fontSize: 11 }}>
                  Le montant HT saisi ({fmt(ht)} FCFA) dépasse le restant à facturer ({fmt(remainingHT)} FCFA).
                </div>
              )}
            </div>
          )}

          <Field label="N° Facture *" value={num} error={errors.num}
            onChange={e => setNum(e.target.value)} placeholder="FAC-2026-001" />
          <Field label="Date *" type="date" value={date} error={errors.date}
            onChange={e => setDate(e.target.value)} />
          <Field label="Montant HT (FCFA) *" type="number" value={ht} error={errors.ht}
            onChange={e => { setHt(+e.target.value); setErrors(v => ({ ...v, ht: '' })); }} />
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
