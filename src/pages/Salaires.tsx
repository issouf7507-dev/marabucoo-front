import { useState } from 'react';
import { Plus, Pencil, Trash2, CreditCard, CheckCircle2, Clock, Users, Printer, X } from 'lucide-react';
import { fmt, MF, MK, initials, THIS_YEAR } from '../utils/format';
import YearSelect from '../components/ui/YearSelect';
import { staffSchema, type StaffInput } from '../schemas';
import { useForm } from '../hooks/useForm';
import { useStaff, useCreateStaff, useUpdateStaff, useDeleteStaff, useUpsertPaie } from '../hooks/queries/useStaff';
import { useParams } from '../hooks/queries/useParams';
import Modal from '../components/ui/Modal';
import Field from '../components/ui/Field';
import { QueryRows, QueryCard } from '../components/ui/QueryState';
import type { ApiStaff } from '../services/staff.service';

// ── Helpers ───────────────────────────────────────────────────────────

function getPaie(s: ApiStaff, mois: string, annee: number) {
  return s.paies.find(p => p.mois === mois && p.annee === annee) ?? null;
}

function PaieStatut({ statut }: { statut: string | null | undefined }) {
  if (!statut) return <span className="bdg bn" style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}><Clock size={10} strokeWidth={2} />Non payé</span>;
  if (statut === 'Payé') return <span className="bdg bg" style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}><CheckCircle2 size={10} strokeWidth={2.5} />Payé</span>;
  if (statut.includes('Partiel') || statut === 'Avance') return <span className="bdg ba">{statut}</span>;
  return <span className="bdg bn">{statut}</span>;
}

// ── Bulletin de paie ─────────────────────────────────────────────────

interface BulletinProps {
  staff: ApiStaff;
  moisLabel: string;
  annee: number;
  montant: number;
  statut: string;
  onClose: () => void;
}

function BulletinPaie({ staff: s, moisLabel, annee, montant, statut, onClose }: BulletinProps) {
  const today    = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const ecart    = montant - s.salaire;
  const initials = s.nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="fac-print-overlay">
      <div className="fac-print-bar">
        <button className="btn prim" onClick={() => window.print()}>
          <Printer size={14} strokeWidth={2} />Imprimer le bulletin
        </button>
        <button className="btn" onClick={onClose}>
          <X size={14} strokeWidth={2} />Fermer
        </button>
      </div>

      <div className="fac-print-doc" style={{ minHeight: 'auto' }}>
        {/* ── En-tête ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #18181b', paddingBottom: 20, marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', color: '#18181b' }}>MARABU SERVICES</div>
            <div style={{ fontSize: 11, color: '#52525b', marginTop: 3 }}>Cabinet de conseil en management</div>
            <div style={{ fontSize: 11, color: '#52525b' }}>Abidjan, Côte d'Ivoire</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#18181b', letterSpacing: '-.03em' }}>BULLETIN DE PAIE</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', marginTop: 4, fontFamily: 'monospace' }}>
              {moisLabel.toUpperCase()} {annee}
            </div>
            <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>Édité le {today}</div>
          </div>
        </div>

        {/* ── Infos collaborateur ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
          <div style={{ background: '#f4f4f5', borderRadius: 8, padding: '16px 18px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#a1a1aa', marginBottom: 10 }}>Collaborateur</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: '#18181b', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 15, flexShrink: 0,
              }}>{initials}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.nom}</div>
                <div style={{ fontSize: 12, color: '#52525b', marginTop: 1 }}>{s.poste ?? '—'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#71717a' }}>Type de contrat</span>
                <span style={{ fontWeight: 600 }}>{s.nature}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#71717a' }}>Charge Marabu</span>
                <span style={{ fontWeight: 600 }}>{s.marabu ? 'Oui' : 'Non'}</span>
              </div>
              {s.debut && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#71717a' }}>Date d'entrée</span>
                  <span style={{ fontWeight: 600 }}>{s.debut.slice(0, 10)}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ background: '#f4f4f5', borderRadius: 8, padding: '16px 18px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#a1a1aa', marginBottom: 10 }}>Période & Statut</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#71717a' }}>Période</span>
                <span style={{ fontWeight: 600 }}>{moisLabel} {annee}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#71717a' }}>Statut paiement</span>
                <span style={{
                  fontWeight: 700, padding: '1px 8px', borderRadius: 4,
                  background: statut === 'Payé' ? '#dcfce7' : '#fef3c7',
                  color: statut === 'Payé' ? '#166534' : '#92400e',
                }}>{statut}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#71717a' }}>Date d'édition</span>
                <span style={{ fontWeight: 600 }}>{today}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Détail de la rémunération ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#a1a1aa', marginBottom: 10 }}>Détail de la rémunération</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#18181b', color: '#fff' }}>
                {['Rubrique', 'Base (FCFA)', 'Montant (FCFA)'].map((h, i) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'right', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e4e4e8' }}>
                <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600 }}>Salaire de base</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace' }}>{s.salaire.toLocaleString('fr-FR')}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>{s.salaire.toLocaleString('fr-FR')}</td>
              </tr>
              {ecart !== 0 && (
                <tr style={{ borderBottom: '1px solid #e4e4e8' }}>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: ecart > 0 ? '#166534' : '#dc2626' }}>
                    {ecart > 0 ? 'Prime / Complément' : 'Retenue / Ajustement'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace' }}>—</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: ecart > 0 ? '#166534' : '#dc2626' }}>
                    {ecart > 0 ? '+' : ''}{ecart.toLocaleString('fr-FR')}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f4f4f5', borderTop: '2px solid #18181b' }}>
                <td style={{ padding: '12px 12px', fontSize: 14, fontWeight: 700 }}>NET À PAYER</td>
                <td></td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 16, fontFamily: 'monospace', fontWeight: 700, color: '#166534' }}>
                  {montant.toLocaleString('fr-FR')} FCFA
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Signatures ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 36 }}>
          {[
            { lbl: 'Signature employeur', sub: 'Marabu Services' },
            { lbl: 'Signature collaborateur', sub: 'Lu et approuvé' },
          ].map(({ lbl, sub }) => (
            <div key={lbl} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>{lbl}</div>
              <div style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 40 }}>{sub}</div>
              <div style={{ borderTop: '1px solid #18181b', paddingTop: 6, fontSize: 10, color: '#71717a' }}>Signature &amp; Date</div>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div style={{ marginTop: 32, borderTop: '1px solid #e4e4e8', paddingTop: 14, fontSize: 10.5, color: '#a1a1aa', textAlign: 'center' }}>
          Marabu Services — Abidjan, Côte d'Ivoire · Ce bulletin est un document confidentiel.
        </div>
      </div>
    </div>
  );
}

const staffInitial: StaffInput = {
  nom: '', poste: '', sal: 0, nature: 'CDI',
  debut: '', fin: '', marabu: true, actif: true,
};

// ── Page ──────────────────────────────────────────────────────────────

export default function Salaires() {
  const { data: staff = [], isLoading, error } = useStaff();
  const { data: params } = useParams();
  const createMutation = useCreateStaff();
  const updateMutation = useUpdateStaff();
  const deleteMutation = useDeleteStaff();
  const paieM          = useUpsertPaie();

  const [tab, setTab]         = useState<'mois' | 'annee' | 'collab'>('mois');
  const [moisIdx, setMoisIdx] = useState(new Date().getMonth());
  const [annee, setAnnee]     = useState(THIS_YEAR);
  const [filActif, setFilActif] = useState('actif');

  // ── Modal collaborateur ──────────────────────────────────────────
  const [collabModal, setCollabModal] = useState(false);
  const [editId, setEditId]           = useState<number | null>(null);
  const form = useForm(staffSchema, staffInitial);

  // ── Modal paiement individuel ────────────────────────────────────
  const [payTarget, setPayTarget]   = useState<ApiStaff | null>(null);
  const [payMontant, setPayMontant] = useState(0);
  const [payStatut, setPayStatut]   = useState('Payé');

  // ── Bulletin de paie ─────────────────────────────────────────────
  const [bulletin, setBulletin] = useState<{
    staff: ApiStaff; montant: number; statut: string;
  } | null>(null);

  // ── Modal paiement en masse ──────────────────────────────────────
  const [bulkModal, setBulkModal] = useState(false);

  const moisKey   = MK[moisIdx];
  const moisLabel = MF[moisIdx];

  const activeStaff = staff.filter(s =>
    (filActif === '' || (filActif === 'actif' ? s.actif : !s.actif))
  );

  // KPIs du mois sélectionné
  const actifs      = staff.filter(s => s.actif);
  const totalBase   = actifs.reduce((s, x) => s + x.salaire, 0);
  const totalPaie   = actifs.reduce((s, x) => s + (getPaie(x, moisKey, annee)?.montant ?? 0), 0);
  const nonPayes    = actifs.filter(x => !getPaie(x, moisKey, annee)?.montant);
  const resteAPayer = totalBase - totalPaie;

  // ── Collaborateur CRUD ───────────────────────────────────────────
  function openNew()  { setEditId(null); form.reset(); setCollabModal(true); }
  function openEdit(s: ApiStaff) {
    setEditId(s.id);
    form.reset({
      nom: s.nom, poste: s.poste ?? '', sal: s.salaire,
      nature: s.nature as StaffInput['nature'],
      debut: s.debut?.slice(0, 10) ?? '', fin: s.fin ?? '',
      marabu: s.marabu, actif: s.actif,
    });
    setCollabModal(true);
  }
  async function saveCollab() {
    if (!form.validate()) return;
    if (editId) await updateMutation.mutateAsync({ id: editId, data: form.values });
    else        await createMutation.mutateAsync(form.values);
    setCollabModal(false);
  }

  // ── Paiement individuel ──────────────────────────────────────────
  function openPay(s: ApiStaff) {
    const existing = getPaie(s, moisKey, annee);
    setPayMontant(existing?.montant ?? s.salaire);
    setPayStatut(existing?.statut ?? 'Payé');
    setPayTarget(s);
  }
  async function savePay() {
    if (!payTarget) return;
    await paieM.mutateAsync({ id: payTarget.id, mois: moisKey, annee: annee, montant: payMontant, statut: payStatut });
    const saved = { staff: payTarget, montant: payMontant, statut: payStatut };
    setPayTarget(null);
    setBulletin(saved);
  }

  // ── Paiement en masse ────────────────────────────────────────────
  async function payAll() {
    await Promise.all(
      nonPayes.map(s =>
        paieM.mutateAsync({ id: s.id, mois: moisKey, annee: annee, montant: s.salaire, statut: 'Payé' })
      )
    );
    setBulkModal(false);
  }

  const isSavingCollab = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="pg">
      <div className="ph">
        <div className="ph-l">
          <h1>Salaires</h1>
          <p>Gestion des collaborateurs et suivi mensuel des paiements</p>
        </div>
        <div className="ph-r">
          <button className="btn" onClick={() => { setTab('collab'); openNew(); }}>
            <Plus size={15} strokeWidth={2.5} />Collaborateur
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kr">
        <div className="kpi b">
          <div className="kpi-l">Effectif actif</div>
          <div className="kpi-v">{actifs.length}</div>
          <div className="kpi-s">{staff.filter(s => !s.actif).length} inactif(s)</div>
        </div>
        <div className="kpi r">
          <div className="kpi-l">Masse salariale budget</div>
          <div className="kpi-v">{fmt(params?.masseSal ?? totalBase)}</div>
          <div className="kpi-s">FCFA / mois</div>
        </div>
        <div className="kpi g">
          <div className="kpi-l">Payé — {moisLabel}</div>
          <div className="kpi-v">{fmt(totalPaie)}</div>
          <div className="kpi-s">{actifs.length - nonPayes.length} / {actifs.length} collaborateurs</div>
        </div>
        <div className={`kpi ${resteAPayer > 0 ? 'a' : 'g'}`}>
          <div className="kpi-l">Reste à payer</div>
          <div className="kpi-v">{fmt(resteAPayer)}</div>
          <div className="kpi-s">{nonPayes.length} collaborateur(s)</div>
        </div>
        <div className="kpi a">
          <div className="kpi-l">Arriéré</div>
          <div className="kpi-v">{fmt((params?.arrSal ?? 0) - (params?.arrSalR ?? 0))}</div>
          <div className="kpi-s">FCFA restants</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        <button className={`tab${tab === 'mois'   ? ' on' : ''}`} onClick={() => setTab('mois')}>Paiement mensuel</button>
        <button className={`tab${tab === 'annee'  ? ' on' : ''}`} onClick={() => setTab('annee')}>Grille annuelle</button>
        <button className={`tab${tab === 'collab' ? ' on' : ''}`} onClick={() => setTab('collab')}>
          <Users size={13} strokeWidth={2} style={{ display: 'inline', marginRight: 5 }} />
          Collaborateurs
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════
          Tab 1 — PAIEMENT MENSUEL
      ════════════════════════════════════════════════════════════ */}
      {tab === 'mois' && (
        <>
          {/* Barre de contrôle */}
          <div className="fr2" style={{ marginBottom: 14 }}>
            <div className="pb" style={{ margin: 0 }}>
              {MK.map((k, i) => (
                <button key={k} className={`pb-btn${moisIdx === i ? ' on' : ''}`} onClick={() => setMoisIdx(i)}>
                  {MF[i].slice(0, 3)}
                </button>
              ))}
            </div>
            <YearSelect value={annee} onChange={setAnnee} />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <select className="sel" value={filActif} onChange={e => setFilActif(e.target.value)} style={{ width: 110 }}>
                <option value="actif">Actifs</option>
                <option value="inactif">Inactifs</option>
                <option value="">Tous</option>
              </select>
              {nonPayes.length > 0 && (
                <button className="btn prim" onClick={() => setBulkModal(true)}>
                  <CheckCircle2 size={14} strokeWidth={2.5} />
                  Tout payer ({nonPayes.length})
                </button>
              )}
            </div>
          </div>

          <div className="card">
            <div className="ch fb">
              <h3>Salaires — {moisLabel} {annee}</h3>
              <div className="fr2">
                <span className="bdg bg">Payé : {fmt(totalPaie)}</span>
                {resteAPayer > 0 && <span className="bdg ba">Reste : {fmt(resteAPayer)}</span>}
              </div>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Collaborateur</th><th>Poste</th><th>Nature</th>
                    <th className="tr">Salaire base</th>
                    <th className="tr">Payé</th>
                    <th>Statut</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <QueryRows isLoading={isLoading} error={error} colSpan={7} />
                  {!isLoading && !error && activeStaff.map(s => {
                    const paie  = getPaie(s, moisKey, annee);
                    const paid  = !!paie?.montant;
                    const ecart = (paie?.montant ?? 0) - s.salaire;
                    return (
                      <tr key={s.id} style={paid ? undefined : { background: 'var(--Al)' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="av" style={{ background: paid ? 'var(--Gl)' : 'var(--Al)', color: paid ? 'var(--G)' : 'var(--A)' }}>
                              {initials(s.nom)}
                            </div>
                            <div>
                              <div className="fw7" style={{ fontSize: 12 }}>{s.nom}</div>
                              {!s.marabu && <span style={{ fontSize: 10, color: 'var(--tx3)' }}>Source ext.</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{s.poste ?? '—'}</td>
                        <td><span className="bdg bn">{s.nature}</span></td>
                        <td className="tnum">{fmt(s.salaire)}</td>
                        <td className="tnum">
                          {paid
                            ? <span style={{ color: 'var(--G)', fontWeight: 700, fontFamily: 'var(--fm)' }}>{fmt(paie!.montant!)}</span>
                            : <span style={{ color: 'var(--tx3)' }}>—</span>
                          }
                          {paid && ecart !== 0 && (
                            <span style={{ fontSize: 10, color: ecart > 0 ? 'var(--G)' : 'var(--R)', marginLeft: 4 }}>
                              ({ecart > 0 ? '+' : ''}{fmt(ecart)})
                            </span>
                          )}
                        </td>
                        <td><PaieStatut statut={paie?.statut} /></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button
                              className={`btn xs ${paid ? '' : 'prim'}`}
                              style={{ gap: 5 }}
                              onClick={() => openPay(s)}
                            >
                              <CreditCard size={12} strokeWidth={2} />
                              {paid ? 'Modifier' : 'Payer'}
                            </button>
                            {paid && (
                              <button
                                className="btn xs"
                                title="Imprimer le bulletin"
                                style={{ gap: 4 }}
                                onClick={() => setBulletin({ staff: s, montant: paie!.montant!, statut: paie!.statut ?? 'Payé' })}
                              >
                                <Printer size={12} strokeWidth={2} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--sur2)', borderTop: '2px solid var(--bor2)' }}>
                    <td colSpan={3} className="fw7" style={{ padding: '7px 10px', fontSize: 12 }}>TOTAL</td>
                    <td className="tnum fw7">{fmt(totalBase)}</td>
                    <td className="tnum fw7 tc">{fmt(totalPaie)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          Tab 2 — GRILLE ANNUELLE
      ════════════════════════════════════════════════════════════ */}
      {tab === 'annee' && (
        <div className="card">
          <div className="ch"><h3>Grille annuelle {annee}</h3></div>
          {isLoading || error
            ? <div className="cb"><QueryCard isLoading={isLoading} error={error} /></div>
            : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 160 }}>Collaborateur</th>
                      {MF.map((m, i) => (
                        <th key={m} className="tr" style={{ minWidth: 76, padding: '8px 4px', fontWeight: moisIdx === i ? 900 : undefined, color: moisIdx === i ? 'var(--G)' : undefined }}>
                          {m.slice(0, 3)}
                        </th>
                      ))}
                      <th className="tr" style={{ minWidth: 90 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(s => {
                      const annuelTotal = MK.reduce((sum, k) => sum + (getPaie(s, k, annee)?.montant ?? 0), 0);
                      return (
                        <tr key={s.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div className="av" style={{ width: 24, height: 24, fontSize: 9 }}>{initials(s.nom)}</div>
                              <div>
                                <div className="fw7" style={{ fontSize: 12 }}>{s.nom}</div>
                                <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{fmt(s.salaire)} / mois</div>
                              </div>
                            </div>
                          </td>
                          {MK.map((k, i) => {
                            const p    = getPaie(s, k, annee);
                            const paid = !!p?.montant;
                            const past = i < new Date().getMonth();
                            const late = past && !paid && s.actif;
                            return (
                              <td key={k} style={{ padding: '4px 3px', textAlign: 'right' }}>
                                {paid
                                  ? (
                                    <span style={{
                                      display: 'inline-block', padding: '2px 5px',
                                      background: p!.statut === 'Payé' ? 'var(--Gl)' : 'var(--Al)',
                                      color: p!.statut === 'Payé' ? 'var(--G)' : 'var(--A)',
                                      borderRadius: 4, fontSize: 10.5, fontFamily: 'var(--fm)', fontWeight: 700,
                                    }}>
                                      {fmt(p!.montant!)}
                                    </span>
                                  )
                                  : late
                                    ? <span style={{ fontSize: 10, color: 'var(--R)', fontWeight: 700 }}>!</span>
                                    : <span style={{ color: 'var(--bor2)', fontSize: 11 }}>—</span>
                                }
                              </td>
                            );
                          })}
                          <td className="tnum fw7 tc" style={{ fontSize: 12 }}>
                            {annuelTotal > 0 ? fmt(annuelTotal) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--sur2)', borderTop: '2px solid var(--bor2)' }}>
                      <td className="fw7" style={{ padding: '7px 10px', fontSize: 12 }}>TOTAL MENSUEL</td>
                      {MK.map(k => {
                        const tot = staff.reduce((s, x) => s + (getPaie(x, k, annee)?.montant ?? 0), 0);
                        return (
                          <td key={k} className="tnum fw7" style={{ fontSize: 11, padding: '7px 4px', color: tot > 0 ? 'var(--G)' : 'var(--tx3)' }}>
                            {tot > 0 ? fmt(tot) : '—'}
                          </td>
                        );
                      })}
                      <td className="tnum fw7 tc" style={{ fontSize: 12 }}>
                        {fmt(MK.reduce((s, k) => s + staff.reduce((a, x) => a + (getPaie(x, k, annee)?.montant ?? 0), 0), 0))}
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
          Tab 3 — COLLABORATEURS
      ════════════════════════════════════════════════════════════ */}
      {tab === 'collab' && (
        <div className="card">
          <div className="ch fb">
            <h3>Liste des collaborateurs</h3>
            <button className="btn prim" onClick={openNew}>
              <Plus size={15} strokeWidth={2.5} />Nouveau
            </button>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Nom</th><th>Poste</th><th>Nature</th>
                  <th className="tr">Salaire base</th>
                  <th>Marabu</th><th>Statut</th><th>Début</th><th>Fin</th><th></th>
                </tr>
              </thead>
              <tbody>
                <QueryRows isLoading={isLoading} error={error} colSpan={9} />
                {!isLoading && !error && (
                  staff.length === 0
                    ? <tr><td colSpan={9} className="empty">Aucun collaborateur</td></tr>
                    : staff.map(s => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="av">{initials(s.nom)}</div>
                            <span className="fw7">{s.nom}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{s.poste ?? '—'}</td>
                        <td><span className="bdg bn">{s.nature}</span></td>
                        <td className="tnum fw7">{fmt(s.salaire)}</td>
                        <td>{s.marabu ? <span className="bdg bg">Oui</span> : <span className="bdg bn">Non</span>}</td>
                        <td>{s.actif ? <span className="bdg bg">Actif</span> : <span className="bdg br">Inactif</span>}</td>
                        <td style={{ fontSize: 11 }}>{s.debut?.slice(0, 10) ?? '—'}</td>
                        <td style={{ fontSize: 11 }}>{s.fin ?? '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="ibt" title="Modifier" onClick={() => openEdit(s)}><Pencil size={13} strokeWidth={2} /></button>
                          <button className="ibt del" title="Supprimer"
                            onClick={() => { if (confirm(`Supprimer ${s.nom} ?`)) deleteMutation.mutate(s.id); }}>
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

      {/* ── Bulletin de paie ── */}
      {bulletin && (
        <BulletinPaie
          staff={bulletin.staff}
          moisLabel={moisLabel}
          annee={annee}
          montant={bulletin.montant}
          statut={bulletin.statut}
          onClose={() => setBulletin(null)}
        />
      )}

      {/* ── Modal paiement individuel ── */}
      <Modal
        open={!!payTarget}
        title={`Paiement — ${payTarget?.nom ?? ''} · ${moisLabel} ${annee}`}
        onClose={() => setPayTarget(null)}
        onSave={savePay}
        saving={paieM.isPending}
        saveLabel={paieM.isPending ? 'Enregistrement…' : 'Confirmer'}
        width={440}
      >
        {payTarget && (
          <>
            <div style={{ background: 'var(--sur2)', border: '1px solid var(--bor)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ color: 'var(--tx3)' }}>Salaire de base</span>
                <strong style={{ fontFamily: 'var(--fm)', color: 'var(--G)' }}>{fmt(payTarget.salaire)} FCFA</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--tx3)' }}>Poste</span>
                <span>{payTarget.poste ?? '—'}</span>
              </div>
            </div>
            <div className="fg">
              <Field label="Montant payé (FCFA) *" type="number" value={payMontant}
                onChange={e => setPayMontant(+e.target.value)} />
              <Field as="select" label="Statut" value={payStatut} onChange={e => setPayStatut(e.target.value)}>
                <option value="Payé">Payé intégralement</option>
                <option value="Partiellement payé">Partiellement payé</option>
                <option value="Avance">Avance sur salaire</option>
              </Field>
            </div>
          </>
        )}
      </Modal>

      {/* ── Modal paiement en masse ── */}
      <Modal
        open={bulkModal}
        title={`Payer tous — ${moisLabel} ${annee}`}
        onClose={() => setBulkModal(false)}
        onSave={payAll}
        saving={paieM.isPending}
        saveLabel={paieM.isPending ? 'Traitement…' : `Confirmer (${nonPayes.length} paiements)`}
        width={500}
      >
        <div className="alert b" style={{ marginBottom: 14 }}>
          Chaque collaborateur sera payé à hauteur de son <strong>salaire de base</strong>. Vous pourrez ajuster individuellement après.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {nonPayes.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'var(--sur2)', borderRadius: 'var(--r)', border: '1px solid var(--bor)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="av">{initials(s.nom)}</div>
                <div>
                  <div className="fw7" style={{ fontSize: 12 }}>{s.nom}</div>
                  <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{s.poste ?? s.nature}</div>
                </div>
              </div>
              <strong style={{ fontFamily: 'var(--fm)', color: 'var(--G)', fontSize: 13 }}>{fmt(s.salaire)} FCFA</strong>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--bor)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: 'var(--tx3)' }}>Total à décaisser</span>
          <strong style={{ fontFamily: 'var(--fm)', color: 'var(--G)' }}>
            {fmt(nonPayes.reduce((s, x) => s + x.salaire, 0))} FCFA
          </strong>
        </div>
      </Modal>

      {/* ── Modal collaborateur ── */}
      <Modal
        open={collabModal}
        title={editId ? 'Modifier collaborateur' : 'Nouveau collaborateur'}
        onClose={() => setCollabModal(false)}
        onSave={saveCollab}
        saving={isSavingCollab}
        saveLabel={isSavingCollab ? 'Enregistrement…' : 'Enregistrer'}
        width={620}
      >
        <div className="fg">
          <Field full label="Nom complet *" value={form.values.nom} error={form.errors.nom}
            onChange={e => form.set('nom', e.target.value)} placeholder="Ex : Aminata Diallo" />
          <Field full label="Poste / Fonction" value={form.values.poste}
            onChange={e => form.set('poste', e.target.value)} placeholder="Ex : Consultante senior" />
          <Field label="Salaire de base (FCFA) *" type="number" value={form.values.sal} error={form.errors.sal}
            onChange={e => form.set('sal', +e.target.value)} />
          <Field as="select" label="Type de contrat" value={form.values.nature}
            onChange={e => form.set('nature', e.target.value as StaffInput['nature'])}>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="Consultant">Consultant</option>
            <option value="Stage">Stage</option>
          </Field>
          <Field label="Date d'entrée" type="date" value={form.values.debut}
            onChange={e => form.set('debut', e.target.value)} />
          <Field label="Date de fin / Échéance" value={form.values.fin}
            onChange={e => form.set('fin', e.target.value)} placeholder="Laisser vide si indéterminé" />
          <Field as="select" label="Payé par Marabu" value={form.values.marabu ? 'oui' : 'non'}
            onChange={e => form.set('marabu', e.target.value === 'oui')}>
            <option value="oui">Oui — charge Marabu</option>
            <option value="non">Non — autre source</option>
          </Field>
          <Field as="select" label="Statut" value={form.values.actif ? 'actif' : 'inactif'}
            onChange={e => form.set('actif', e.target.value === 'actif')}>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif / Parti</option>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
