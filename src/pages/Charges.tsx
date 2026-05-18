import { useRef, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, CreditCard, CheckCircle2, Clock, LayoutList } from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import { fmt, MF, MK, CAT_LBL, THIS_YEAR } from '../utils/format';
import YearSelect from '../components/ui/YearSelect';
import { chargeSchema, type ChargeInput } from '../schemas';
import { useForm } from '../hooks/useForm';
import {
  useCharges, useCreateCharge, useUpdateCharge, useDeleteCharge, useUpsertChargeReel,
} from '../hooks/queries/useCharges';
import Modal from '../components/ui/Modal';
import Field from '../components/ui/Field';
import { QueryRows, QueryCard } from '../components/ui/QueryState';
import type { ApiCharge } from '../services/charges.service';

Chart.register(...registerables);

// ── Helpers ───────────────────────────────────────────────────────────

function getReel(c: ApiCharge, mois: string, annee: number) {
  return c.realisations.find(r => r.mois === mois && r.annee === annee) ?? null;
}

function ReelStatut({ statut }: { statut: string | null | undefined }) {
  if (!statut || statut === 'Non payé')
    return <span className="bdg bn" style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}><Clock size={10} strokeWidth={2} />Non payé</span>;
  if (statut === 'Payé')
    return <span className="bdg bg" style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}><CheckCircle2 size={10} strokeWidth={2.5} />Payé</span>;
  if (statut.includes('Partiel'))
    return <span className="bdg ba">{statut}</span>;
  return <span className="bdg bn">{statut}</span>;
}

const chargeInitial: ChargeInput = {
  lib: '', cat: 'EXPLOIT', nature: 'fixe', type: 'prevu',
  per: 'Mensuelle', budget: 0, moisApplicables: '', obs: '',
};

// Returns true if the charge is budgeted for the given month key
function isApplicable(c: { periodicite: string; moisApplicables: string }, moisKey: string): boolean {
  if (!c.moisApplicables || c.moisApplicables.trim() === '') return true;
  return c.moisApplicables.split(',').includes(moisKey);
}

function budgetMois(c: { budget: number; nature: string; periodicite: string; moisApplicables: string }, moisKey: string): number {
  if (c.nature === 'variable') return 0; // variable charges never add to monthly budget
  return isApplicable(c, moisKey) ? (c.budget || 0) : 0;
}

// ── Page ──────────────────────────────────────────────────────────────

export default function Charges() {
  const { data: charges = [], isLoading, error } = useCharges();
  const createMutation  = useCreateCharge();
  const updateMutation  = useUpdateCharge();
  const deleteMutation  = useDeleteCharge();
  const reelMutation    = useUpsertChargeReel();

  const chgRef   = useRef<HTMLCanvasElement>(null);
  const chgChart = useRef<Chart | null>(null);

  const [tab, setTab]         = useState<'mois' | 'annee' | 'postes'>('mois');
  const [moisIdx, setMoisIdx] = useState(new Date().getMonth());
  const [annee, setAnnee]     = useState(THIS_YEAR);
  const [filCat, setFilCat]   = useState('');
  const [filNature, setFilNature] = useState('');

  // ── Modal poste de charge ─────────────────────────────────────────
  const [posteModal, setPosteModal] = useState(false);
  const [editId, setEditId]         = useState<number | null>(null);
  const form = useForm(chargeSchema, chargeInitial);

  // ── Modal saisie réalisé ──────────────────────────────────────────
  const [payTarget, setPayTarget] = useState<ApiCharge | null>(null);
  const [payMontant, setPayMontant] = useState(0);
  const [payStatut, setPayStatut]   = useState('Payé');
  const [payDate, setPayDate]       = useState('');

  const moisKey   = MK[moisIdx];
  const moisLabel = MF[moisIdx];

  const filtered = charges.filter(c =>
    (!filCat    || c.categorie === filCat) &&
    (!filNature || c.nature    === filNature)
  );

  // KPIs — budget ne compte que pour les mois applicables de chaque charge
  const totalBudget = filtered.reduce((s, c) => s + budgetMois(c, moisKey), 0);
  const totalReel   = filtered.reduce((s, c) => s + (getReel(c, moisKey, annee)?.montant ?? 0), 0);
  const ecart       = totalReel - totalBudget;
  // Variable charges are never "non saisies" — they have no recurring budget obligation
  const nonSaisies  = filtered.filter(c => c.nature !== 'variable' && isApplicable(c, moisKey) && !getReel(c, moisKey, annee)?.montant);

  // ── Graphique ─────────────────────────────────────────────────────
  useEffect(() => {
    chgChart.current?.destroy();
    const fixes = charges.filter(c => c.nature !== 'variable');
    const prevMois = MF.map((_, i) => fixes.reduce((s, c) => s + budgetMois(c, MK[i]), 0));
    const reelMoisData = MF.map((_, i) => {
      const k = MK[i];
      return fixes.reduce((s, c) => s + (getReel(c, k, annee)?.montant ?? 0), 0);
    });
    if (chgRef.current) {
      chgChart.current = new Chart(chgRef.current, {
        type: 'bar',
        data: {
          labels: MF.map(m => m.slice(0, 3)),
          datasets: [
            { label: 'Budget (fixe)', data: prevMois,     backgroundColor: 'rgba(181,98,10,.25)',  borderColor: '#B5620A', borderWidth: 1.5 },
            { label: 'Réalisé (fixe)', data: reelMoisData, backgroundColor: 'rgba(181,58,42,.5)',   borderColor: '#B53A2A', borderWidth: 1.5 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 12 } } },
          scales: { y: { ticks: { callback: v => Math.round(Number(v) / 1000) + 'K', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,.04)' } } },
        },
      });
    }
    return () => { chgChart.current?.destroy(); };
  }, [charges, annee]);

  // ── Poste CRUD ────────────────────────────────────────────────────
  function openNew()  { setEditId(null); form.reset(); setPosteModal(true); }
  function openEdit(c: ApiCharge) {
    setEditId(c.id);
    form.reset({
      lib: c.libelle, cat: c.categorie as ChargeInput['cat'],
      nature: c.nature as ChargeInput['nature'], type: c.type as ChargeInput['type'],
      per: c.periodicite, budget: c.budget, moisApplicables: c.moisApplicables ?? '', obs: c.obs ?? '',
    });
    setPosteModal(true);
  }
  async function savePoste() {
    if (!form.validate()) return;
    if (editId) await updateMutation.mutateAsync({ id: editId, data: form.values });
    else        await createMutation.mutateAsync(form.values);
    setPosteModal(false);
  }

  // ── Saisie réalisé ────────────────────────────────────────────────
  function openPay(c: ApiCharge) {
    const existing = getReel(c, moisKey, annee);
    setPayMontant(existing?.montant ?? c.budget);
    setPayStatut(existing?.statut ?? 'Payé');
    setPayDate(existing?.datePmt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setPayTarget(c);
  }
  async function savePay() {
    if (!payTarget) return;
    await reelMutation.mutateAsync({
      id: payTarget.id, mois: moisKey, annee,
      montant: payMontant, statut: payStatut,
      datePmt: payDate || undefined,
    });
    setPayTarget(null);
  }

  // ── Tout saisir au budget ─────────────────────────────────────────
  async function payAll() {
    const today = new Date().toISOString().slice(0, 10);
    await Promise.all(
      nonSaisies.map(c =>
        reelMutation.mutateAsync({ id: c.id, mois: moisKey, annee, montant: c.budget, statut: 'Payé', datePmt: today })
      )
    );
  }

  const isSavingPoste = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="pg">
      <div className="ph">
        <div className="ph-l">
          <h1>Charges fixes & Variables</h1>
          <p>Budget prévu vs réalisé mensuel — dépassements mis en évidence</p>
        </div>
        <div className="ph-r">
          <button className="btn" onClick={() => { setTab('postes'); openNew(); }}>
            <Plus size={15} strokeWidth={2.5} />Poste de charge
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kr">
        <div className="kpi b">
          <div className="kpi-l">Postes</div>
          <div className="kpi-v">{charges.length}</div>
          <div className="kpi-s">{charges.filter(c => c.nature === 'fixe').length} fixes · {charges.filter(c => c.nature === 'variable').length} variables</div>
        </div>
        <div className="kpi a">
          <div className="kpi-l">Budget mensuel</div>
          <div className="kpi-v">{fmt(totalBudget)}</div>
          <div className="kpi-s">FCFA prévu</div>
        </div>
        <div className="kpi r">
          <div className="kpi-l">Réalisé — {moisLabel}</div>
          <div className="kpi-v">{fmt(totalReel)}</div>
          <div className="kpi-s">FCFA saisis</div>
        </div>
        <div className={`kpi ${ecart > 0 ? 'r' : ecart < 0 ? 'g' : 'bn'}`}>
          <div className="kpi-l">{ecart > 0 ? 'Dépassement' : ecart < 0 ? 'Économie' : 'Écart'}</div>
          <div className="kpi-v">{fmt(Math.abs(ecart))}</div>
          <div className="kpi-s">FCFA {ecart > 0 ? 'de plus' : ecart < 0 ? 'économisés' : 'neutre'}</div>
        </div>
        <div className={`kpi ${nonSaisies.length > 0 ? 'a' : 'g'}`}>
          <div className="kpi-l">Non saisis</div>
          <div className="kpi-v">{nonSaisies.length}</div>
          <div className="kpi-s">poste{nonSaisies.length !== 1 ? 's' : ''} ce mois</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        <button className={`tab${tab === 'mois'   ? ' on' : ''}`} onClick={() => setTab('mois')}>Suivi mensuel</button>
        <button className={`tab${tab === 'annee'  ? ' on' : ''}`} onClick={() => setTab('annee')}>Vue annuelle</button>
        <button className={`tab${tab === 'postes' ? ' on' : ''}`} onClick={() => setTab('postes')}>
          <LayoutList size={13} strokeWidth={2} style={{ display: 'inline', marginRight: 5 }} />
          Postes
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════
          Tab 1 — SUIVI MENSUEL
      ════════════════════════════════════════════════════════════ */}
      {tab === 'mois' && (
        <>
          {/* Barre de contrôle */}
          <div className="fr2" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            <div className="pb" style={{ margin: 0 }}>
              {MK.map((k, i) => (
                <button key={k} className={`pb-btn${moisIdx === i ? ' on' : ''}`} onClick={() => setMoisIdx(i)}>
                  {MF[i].slice(0, 3)}
                </button>
              ))}
            </div>
            <YearSelect value={annee} onChange={setAnnee} />
            <select className="sel" value={filCat} onChange={e => setFilCat(e.target.value)} style={{ width: 170 }}>
              <option value="">Toutes catégories</option>
              {Object.entries(CAT_LBL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="sel" value={filNature} onChange={e => setFilNature(e.target.value)} style={{ width: 130 }}>
              <option value="">Fixe + Variable</option>
              <option value="fixe">Fixe seulement</option>
              <option value="variable">Variable seulement</option>
            </select>
            {nonSaisies.length > 0 && (
              <button className="btn prim" style={{ marginLeft: 'auto' }} onClick={payAll}
                disabled={reelMutation.isPending}>
                <CheckCircle2 size={14} strokeWidth={2.5} />
                Tout saisir au budget ({nonSaisies.length})
              </button>
            )}
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch fb">
              <h3>Charges — {moisLabel} {annee}</h3>
              <div className="fr2">
                <span className="bdg ba">Budget : {fmt(totalBudget)}</span>
                <span className={`bdg ${ecart > 0 ? 'br' : 'bg'}`}>Réalisé : {fmt(totalReel)}</span>
              </div>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Poste</th><th>Catégorie</th><th>Nature</th>
                    <th className="tr">Budget</th>
                    <th className="tr">Réalisé</th>
                    <th className="tr">Écart</th>
                    <th>Statut</th><th>Date pmt</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <QueryRows isLoading={isLoading} error={error} colSpan={9} />
                  {!isLoading && !error && filtered.map(c => {
                    const isVar    = c.nature === 'variable';
                    const applicable = isVar || isApplicable(c, moisKey);
                    const reel = getReel(c, moisKey, annee);
                    const r    = reel?.montant ?? 0;
                    const bud  = budgetMois(c, moisKey);
                    const ec   = r - bud;
                    const paid = !!reel?.montant;
                    return (
                      <tr key={c.id} style={
                        !applicable ? { opacity: .5 } :
                        ec > 0 && r > 0 ? { background: 'var(--Rl)' } :    // réalisé dépasse budget (y compris variables à budget 0)
                        !isVar && !paid ? { background: 'var(--Al)' } :      // fixe non saisi
                        undefined
                      }>
                        <td className="fw7">{c.libelle}</td>
                        <td><span className="bdg bn">{CAT_LBL[c.categorie] || c.categorie}</span></td>
                        <td><span className={`bdg ${c.nature === 'fixe' ? 'bb' : 'bp'}`}>{c.nature}</span></td>
                        <td className="tnum">
                          {isVar
                            ? <span style={{ fontSize: 10, color: 'var(--tx3)', fontStyle: 'italic' }}>Variable</span>
                            : applicable ? fmt(bud) : <span style={{ color: 'var(--tx3)' }}>—</span>
                          }
                        </td>
                        <td className="tnum">
                          {!applicable
                            ? <span className="bdg bn" style={{ fontSize: 9 }}>N/A ce mois</span>
                            : paid
                              ? <span style={{ color: ec > 0 ? 'var(--R)' : 'var(--G)', fontWeight: 700, fontFamily: 'var(--fm)' }}>{fmt(r)}</span>
                              : <span style={{ color: 'var(--tx3)' }}>—</span>
                          }
                        </td>
                        <td className={`tnum ${ec > 0 && r > 0 ? 'rc' : ec < 0 ? 'tc' : ''}`}>
                          {applicable && ec !== 0 && r > 0 ? `${ec > 0 ? '+' : ''}${fmt(ec)}` : '—'}
                        </td>
                        <td>
                          {!applicable
                            ? <span style={{ color: 'var(--tx3)', fontSize: 11 }}>—</span>
                            : isVar && !paid
                              ? <span style={{ color: 'var(--tx3)', fontSize: 11 }}>—</span>
                              : <ReelStatut statut={reel?.statut} />
                          }
                        </td>
                        <td style={{ fontSize: 11 }}>{reel?.datePmt?.slice(0, 10) ?? '—'}</td>
                        <td>
                          {applicable && (
                            <button
                              className={`btn xs ${!isVar && !paid ? 'prim' : ''}`}
                              style={{ gap: 5 }}
                              onClick={() => openPay(c)}
                            >
                              <CreditCard size={12} strokeWidth={2} />
                              {paid ? 'Modifier' : 'Saisir'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--sur2)', borderTop: '2px solid var(--bor2)' }}>
                    <td colSpan={3} className="fw7" style={{ padding: '7px 10px', fontSize: 12 }}>TOTAL</td>
                    <td className="tnum fw7">{fmt(totalBudget)}</td>
                    <td className="tnum fw7" style={{ color: totalReel > 0 ? (ecart > 0 ? 'var(--R)' : 'var(--G)') : 'var(--tx3)' }}>{totalReel > 0 ? fmt(totalReel) : '—'}</td>
                    <td className={`tnum fw7 ${ecart > 0 ? 'rc' : ecart < 0 ? 'tc' : ''}`}>
                      {ecart !== 0 ? `${ecart > 0 ? '+' : ''}${fmt(ecart)}` : '—'}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Graphique */}
          <div className="card">
            <div className="ch fb">
              <h3>Budget vs Réalisé (charges fixes) — {annee}</h3>
              <YearSelect value={annee} onChange={setAnnee} />
            </div>
            <div className="cb">
              <div className="cw" style={{ height: 240 }}><canvas ref={chgRef} /></div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          Tab 2 — VUE ANNUELLE
      ════════════════════════════════════════════════════════════ */}
      {tab === 'annee' && (
        <div className="card">
          <div className="ch fb">
            <h3>Grille annuelle {annee}</h3>
            <YearSelect value={annee} onChange={setAnnee} />
          </div>
          {isLoading || error
            ? <div className="cb"><QueryCard isLoading={isLoading} error={error} /></div>
            : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 160 }}>Poste</th>
                      <th>Budget</th>
                      {MF.map((m, i) => (
                        <th key={m} className="tr" style={{
                          minWidth: 72, padding: '8px 3px',
                          fontWeight: moisIdx === i ? 900 : undefined,
                          color: moisIdx === i ? 'var(--G)' : undefined,
                        }}>
                          {m.slice(0, 3)}
                        </th>
                      ))}
                      <th className="tr" style={{ minWidth: 90 }}>Total réalisé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map(c => {
                      const annuelTotal = MK.reduce((s, k) => s + (getReel(c, k, annee)?.montant ?? 0), 0);
                      return (
                        <tr key={c.id}>
                          <td>
                            <div className="fw7" style={{ fontSize: 12 }}>{c.libelle}</div>
                            <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{CAT_LBL[c.categorie]}</div>
                          </td>
                          <td className="tnum" style={{ fontSize: 11, color: 'var(--A)' }}>{fmt(c.budget)}</td>
                          {MK.map((k, i) => {
                            const reel  = getReel(c, k, annee);
                            const val   = reel?.montant ?? 0;
                            const appli = c.nature !== 'variable' && isApplicable(c, k);
                            const past  = i < new Date().getMonth() && annee === THIS_YEAR;
                            const late  = past && !val && c.budget > 0 && appli;
                            const over  = val > c.budget && c.budget > 0;
                            return (
                              <td key={k} style={{ padding: '4px 3px', textAlign: 'right' }}>
                                {val > 0
                                  ? (
                                    <span style={{
                                      display: 'inline-block', padding: '2px 5px',
                                      background: over ? 'var(--Rl)' : reel?.statut === 'Payé' ? 'var(--Gl)' : 'var(--Al)',
                                      color: over ? 'var(--R)' : reel?.statut === 'Payé' ? 'var(--G)' : 'var(--A)',
                                      borderRadius: 4, fontSize: 10.5, fontFamily: 'var(--fm)', fontWeight: 700,
                                    }}>
                                      {fmt(val)}
                                    </span>
                                  )
                                  : late
                                    ? <span style={{ fontSize: 10, color: 'var(--R)', fontWeight: 700 }}>!</span>
                                    : <span style={{ color: appli ? 'var(--bor2)' : 'var(--bor)', fontSize: 11 }}>—</span>
                                }
                              </td>
                            );
                          })}
                          <td className="tnum fw7" style={{ fontSize: 12, color: annuelTotal > 0 ? (annuelTotal > c.budget * 12 ? 'var(--R)' : 'var(--G)') : 'var(--tx3)' }}>
                            {annuelTotal > 0 ? fmt(annuelTotal) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--sur2)', borderTop: '2px solid var(--bor2)' }}>
                      <td className="fw7" style={{ padding: '7px 10px', fontSize: 12 }}>TOTAL BUDGET</td>
                      <td className="tnum fw7" style={{ color: 'var(--A)', fontSize: 11 }}>/ occurrence</td>
                      {MK.map(k => {
                        const budM = charges.reduce((s, c) => s + budgetMois(c, k), 0);
                        const tot  = charges.reduce((s, c) => s + (getReel(c, k, annee)?.montant ?? 0), 0);
                        return (
                          <td key={k} className="tnum" style={{ fontSize: 10, padding: '4px 3px', textAlign: 'right' }}>
                            <div style={{ color: 'var(--A)', fontWeight: 600 }}>{fmt(budM)}</div>
                            {tot > 0 && <div style={{ color: tot > budM ? 'var(--R)' : 'var(--G)', fontWeight: 700, fontSize: 10.5 }}>{fmt(tot)}</div>}
                          </td>
                        );
                      })}
                      <td className="tnum fw7 tc" style={{ fontSize: 12 }}>
                        {fmt(MK.reduce((s, k) => s + charges.reduce((a, c) => a + (getReel(c, k, annee)?.montant ?? 0), 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          Tab 3 — POSTES DE CHARGE
      ════════════════════════════════════════════════════════════ */}
      {tab === 'postes' && (
        <div className="card">
          <div className="ch fb">
            <h3>Postes de charge</h3>
            <button className="btn prim" onClick={openNew}>
              <Plus size={15} strokeWidth={2.5} />Nouveau
            </button>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Libellé</th><th>Catégorie</th><th>Nature</th><th>Type</th>
                  <th>Périodicité</th><th>Mois applicables</th><th className="tr">Budget / occurrence</th><th>Observations</th><th></th>
                </tr>
              </thead>
              <tbody>
                <QueryRows isLoading={isLoading} error={error} colSpan={8} />
                {!isLoading && !error && (
                  charges.length === 0
                    ? <tr><td colSpan={8} className="empty">Aucun poste de charge</td></tr>
                    : charges.map(c => (
                      <tr key={c.id}>
                        <td className="fw7">{c.libelle}</td>
                        <td><span className="bdg bn">{CAT_LBL[c.categorie] || c.categorie}</span></td>
                        <td><span className={`bdg ${c.nature === 'fixe' ? 'bb' : 'bp'}`}>{c.nature}</span></td>
                        <td><span className={`bdg ${c.type === 'imprevu' ? 'br' : 'bn'}`}>{c.type}</span></td>
                        <td style={{ fontSize: 11 }}>{c.periodicite}</td>
                        <td style={{ fontSize: 10 }}>
                          {c.moisApplicables
                            ? c.moisApplicables.split(',').map(k => {
                                const i = MK.indexOf(k as typeof MK[number]);
                                return i >= 0 ? (
                                  <span key={k} className="bdg bg" style={{ marginRight: 2, fontSize: 9 }}>{MF[i].slice(0, 3)}</span>
                                ) : null;
                              })
                            : <span style={{ color: 'var(--tx3)' }}>Tous les mois</span>
                          }
                        </td>
                        <td className="tnum fw7">{fmt(c.budget)}</td>
                        <td style={{ fontSize: 11, color: 'var(--tx3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.obs ?? '—'}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="ibt" title="Modifier" onClick={() => openEdit(c)}><Pencil size={13} strokeWidth={2} /></button>
                          <button className="ibt del" title="Supprimer"
                            onClick={() => { if (confirm(`Supprimer « ${c.libelle} » ?`)) deleteMutation.mutate(c.id); }}>
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal saisie réalisé ── */}
      <Modal
        open={!!payTarget}
        title={`Saisir réalisé — ${payTarget?.libelle ?? ''} · ${moisLabel} ${annee}`}
        onClose={() => setPayTarget(null)}
        onSave={savePay}
        saving={reelMutation.isPending}
        saveLabel={reelMutation.isPending ? 'Enregistrement…' : 'Confirmer'}
        width={440}
      >
        {payTarget && (
          <>
            <div style={{ background: 'var(--sur2)', border: '1px solid var(--bor)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ color: 'var(--tx3)' }}>Budget prévu</span>
                <strong style={{ fontFamily: 'var(--fm)', color: 'var(--A)' }}>{fmt(payTarget.budget)} FCFA</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--tx3)' }}>Catégorie</span>
                <span>{CAT_LBL[payTarget.categorie] ?? payTarget.categorie}</span>
              </div>
            </div>
            <div className="fg">
              <Field label="Montant réalisé (FCFA) *" type="number" value={payMontant}
                onChange={e => setPayMontant(+e.target.value)} />
              <Field as="select" label="Statut" value={payStatut} onChange={e => setPayStatut(e.target.value)}>
                <option value="Payé">Payé</option>
                <option value="Partiellement payé">Partiellement payé</option>
                <option value="Non payé">Non payé</option>
              </Field>
              <Field full label="Date de paiement" type="date" value={payDate}
                onChange={e => setPayDate(e.target.value)} />
            </div>
            {payMontant > payTarget.budget && payTarget.budget > 0 && (
              <div className="alert r" style={{ marginTop: 12 }}>
                Dépassement de budget : +{fmt(payMontant - payTarget.budget)} FCFA
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Modal poste de charge ── */}
      <Modal
        open={posteModal}
        title={editId ? 'Modifier poste' : 'Nouveau poste de charge'}
        onClose={() => setPosteModal(false)}
        onSave={savePoste}
        saving={isSavingPoste}
        saveLabel={isSavingPoste ? 'Enregistrement…' : 'Enregistrer'}
        width={600}
      >
        <div className="fg">
          <Field full label="Libellé *" value={form.values.lib} error={form.errors.lib}
            onChange={e => form.set('lib', e.target.value)} placeholder="Ex : Loyer bureau" />
          <Field as="select" label="Catégorie *" value={form.values.cat} error={form.errors.cat}
            onChange={e => form.set('cat', e.target.value as ChargeInput['cat'])}>
            {Object.entries(CAT_LBL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Field>
          <Field as="select" label="Nature" value={form.values.nature}
            onChange={e => form.set('nature', e.target.value as ChargeInput['nature'])}>
            <option value="fixe">Fixe</option>
            <option value="variable">Variable</option>
          </Field>
          <Field as="select" label="Type" value={form.values.type}
            onChange={e => form.set('type', e.target.value as ChargeInput['type'])}>
            <option value="prevu">Prévu</option>
            <option value="imprevu">Imprévu</option>
          </Field>
          <Field as="select" label="Périodicité" value={form.values.per} error={form.errors.per}
            onChange={e => {
              form.set('per', e.target.value);
              if (e.target.value === 'Mensuelle') form.set('moisApplicables', '');
            }}>
            <option value="Mensuelle">Mensuelle</option>
            <option value="Trimestrielle">Trimestrielle</option>
            <option value="Semestrielle">Semestrielle</option>
            <option value="Annuelle">Annuelle</option>
            <option value="Ponctuelle">Ponctuelle</option>
          </Field>
          {form.values.per !== 'Mensuelle' && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="lbl" style={{ marginBottom: 6, display: 'block' }}>
                Mois d'application * <span style={{ fontSize: 10, color: 'var(--tx3)', fontWeight: 400 }}>(cochez les mois où cette charge est due)</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {MK.map((k, i) => {
                  const checked = (form.values.moisApplicables ?? '').split(',').filter(Boolean).includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        const current = (form.values.moisApplicables ?? '').split(',').filter(Boolean);
                        const next = checked ? current.filter(m => m !== k) : [...current, k];
                        form.set('moisApplicables', next.join(','));
                      }}
                      style={{
                        padding: '4px 10px', borderRadius: 4, fontSize: 11,
                        fontFamily: 'var(--fm)', fontWeight: 700, cursor: 'pointer',
                        border: '1px solid',
                        borderColor: checked ? 'var(--G)' : 'var(--bor)',
                        background: checked ? 'var(--Gl)' : 'var(--sur2)',
                        color: checked ? 'var(--G)' : 'var(--tx3)',
                      }}
                    >
                      {MF[i].slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              {(form.values.moisApplicables ?? '').split(',').filter(Boolean).length === 0 && (
                <div style={{ fontSize: 10, color: 'var(--A)', fontFamily: 'var(--fm)', marginTop: 4 }}>
                  Aucun mois sélectionné — la charge s'appliquera chaque mois
                </div>
              )}
            </div>
          )}
          <Field label="Montant par occurrence (FCFA)" type="number" value={form.values.budget} error={form.errors.budget}
            onChange={e => form.set('budget', +e.target.value)} />
          <Field full label="Observations" value={form.values.obs}
            onChange={e => form.set('obs', e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
