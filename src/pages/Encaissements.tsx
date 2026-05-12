import { useState, useMemo } from 'react';
import { CheckCircle2, Clock, AlertCircle, TrendingUp, CreditCard, Plus } from 'lucide-react';
import { fmt, MF, MK, THIS_YEAR } from '../utils/format';
import { useFactures, useUpdateTranche } from '../hooks/queries/useFactures';
import { useDepenses } from '../hooks/queries/useDepenses';
import { QueryCard } from '../components/ui/QueryState';
import Modal from '../components/ui/Modal';
import Field from '../components/ui/Field';
import type { ApiTranche } from '../services/factures.service';

// ── Helpers ───────────────────────────────────────────────────────────

type FlatTranche = ApiTranche & {
  facNum: string; facId: number; misNom: string; misId: number; client: string;
};

function trancheMonth(t: ApiTranche): string | null {
  if (!t.dateEnc) return null;
  return new Date(t.dateEnc).toISOString().slice(0, 7);
}

function echeanceMonth(t: ApiTranche): string {
  return new Date(t.echeance).toISOString().slice(0, 7);
}

function mkToYM(mk: string, year = THIS_YEAR): string {
  const idx = MK.indexOf(mk as (typeof MK)[number]);
  return `${year}-${String(idx + 1).padStart(2, '0')}`;
}

function StatusBadge({ t }: { t: ApiTranche }) {
  if (t.encaisse >= t.montant)
    return <span className="bdg bg" style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      <CheckCircle2 size={10} strokeWidth={2.5} />Soldé
    </span>;
  const late = new Date(t.echeance) < new Date();
  if (t.encaisse > 0)
    return <span className="bdg ba">Partiel</span>;
  return <span className={`bdg ${late ? 'br' : 'bn'}`} style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
    {late ? <AlertCircle size={10} strokeWidth={2} /> : <Clock size={10} strokeWidth={2} />}
    {late ? 'En retard' : 'En attente'}
  </span>;
}

// ── Modal paiement (réutilisé partout dans la page) ───────────────────

interface PayModalProps {
  tranche: FlatTranche | null;
  onClose: () => void;
}

function PayModal({ tranche, onClose }: PayModalProps) {
  const mutation = useUpdateTranche();
  const [enc,    setEnc]    = useState(tranche?.montant ?? 0);
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10));
  const [ref,    setRef]    = useState('');
  const [statut, setStatut] = useState('Payé');

  // Re-init si la tranche change
  useMemo(() => {
    if (!tranche) return;
    setEnc(tranche.encaisse > 0 ? tranche.encaisse : tranche.montant);
    setDate(tranche.dateEnc?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setStatut(tranche.encaisse >= tranche.montant ? 'Payé' : tranche.encaisse > 0 ? 'Partiellement payé' : 'Payé');
    // Génère une référence auto si aucune n'existe déjà
    if (tranche.ref) {
      setRef(tranche.ref);
    } else {
      const now  = new Date();
      const yyyy = now.getFullYear();
      const mm   = String(now.getMonth() + 1).padStart(2, '0');
      const id   = String(tranche.id).padStart(4, '0');
      setRef(`VIR-${yyyy}-${mm}-${id}`);
    }
  }, [tranche]);

  async function save() {
    if (!tranche) return;
    await mutation.mutateAsync({
      factureId: tranche.facId,
      tid: tranche.id,
      data: { encaisse: enc, dateEnc: date || undefined, ref: ref || undefined, statut },
    });
    onClose();
  }

  if (!tranche) return null;
  return (
    <Modal
      open
      title={`Saisir paiement — ${tranche.misNom} · Tranche ${tranche.num}`}
      onClose={onClose}
      onSave={save}
      saving={mutation.isPending}
      saveLabel={mutation.isPending ? 'Enregistrement…' : 'Confirmer le paiement'}
      width={480}
    >
      <div style={{ background: 'var(--sur2)', border: '1px solid var(--bor)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: 'var(--tx3)' }}>Facture</span>
          <span className="fw7">{tranche.facNum}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: 'var(--tx3)' }}>Échéance</span>
          <span>{tranche.echeance.slice(0, 10)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--tx3)' }}>Montant attendu</span>
          <span className="fw7" style={{ color: 'var(--G)', fontFamily: 'var(--fm)' }}>{fmt(tranche.montant)} FCFA</span>
        </div>
      </div>
      <div className="fg">
        <Field label="Montant encaissé (FCFA) *" type="number" value={enc}
          onChange={e => setEnc(+e.target.value)} />
        <Field as="select" label="Statut" value={statut} onChange={e => setStatut(e.target.value)}>
          <option value="Payé">Payé intégralement</option>
          <option value="Partiellement payé">Partiellement payé</option>
          <option value="En attente">En attente</option>
        </Field>
        <Field label="Date de réception *" type="date" value={date}
          onChange={e => setDate(e.target.value)} />
        <Field label="Référence / N° virement" value={ref}
          onChange={e => setRef(e.target.value)} placeholder="VIR-2026-xxx" />
      </div>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function Encaissements() {
  const { data: factures = [], isLoading: fLoad, error: fErr } = useFactures();
  const { data: depenses = [] } = useDepenses();

  const [tab, setTab]         = useState<'mois' | 'mission' | 'banque'>('mois');
  const [selMois, setSelMois] = useState<string>(MK[new Date().getMonth()]);
  const [payTranche, setPayTranche] = useState<FlatTranche | null>(null);

  // ── Toutes les tranches à plat ────────────────────────────────────
  const allTranches = useMemo(() =>
    factures.flatMap(f =>
      f.tranches.map(t => ({
        ...t,
        facNum: f.num, facId: f.id,
        misNom: f.mission.nom, misId: f.mission.id, client: f.mission.client,
      }))
    ),
    [factures]
  );

  // ── KPIs ─────────────────────────────────────────────────────────
  const totalTTC  = factures.reduce((s, f) => s + f.ttc, 0);
  const totalEnc  = allTranches.reduce((s, t) => s + t.encaisse, 0);
  const enAttente = totalTTC - totalEnc;
  const tauxEnc   = totalTTC > 0 ? Math.round(totalEnc / totalTTC * 100) : 0;

  const entreesBanque = depenses.filter(d => d.type === 'ENTREE BANQUE');
  const totalBanque   = entreesBanque.reduce((s, d) => s + (d.credit || 0), 0);

  // ── Mois sélectionné ─────────────────────────────────────────────
  const ym = mkToYM(selMois);
  const recuCeMois   = allTranches.filter(t => trancheMonth(t) === ym);
  const prevuCeMois  = allTranches.filter(t =>
    echeanceMonth(t) === ym && t.encaisse < t.montant && trancheMonth(t) !== ym
  );
  const totalRecuMois  = recuCeMois.reduce((s, t) => s + t.encaisse, 0);
  const totalPrevuMois = prevuCeMois.reduce((s, t) => s + t.montant, 0);

  // Toutes les tranches non soldées, triées par échéance (pour le bouton global)
  const tranchesEnAttente = allTranches
    .filter(t => t.encaisse < t.montant)
    .sort((a, b) => new Date(a.echeance).getTime() - new Date(b.echeance).getTime());

  // ── Par mission ───────────────────────────────────────────────────
  const byMission = useMemo(() => {
    const map = new Map<number, {
      misId: number; nom: string; client: string;
      ttc: number; enc: number; nbTranches: number; nbSoldees: number; lastEnc: string | null;
    }>();
    for (const f of factures) {
      const key = f.mission.id;
      const x = map.get(key) ?? {
        misId: key, nom: f.mission.nom, client: f.mission.client,
        ttc: 0, enc: 0, nbTranches: 0, nbSoldees: 0, lastEnc: null,
      };
      x.ttc += f.ttc;
      for (const t of f.tranches) {
        x.enc += t.encaisse;
        x.nbTranches++;
        if (t.encaisse >= t.montant) x.nbSoldees++;
        if (t.dateEnc && (!x.lastEnc || t.dateEnc > x.lastEnc)) x.lastEnc = t.dateEnc;
      }
      map.set(key, x);
    }
    return [...map.values()].sort((a, b) => b.ttc - a.ttc);
  }, [factures]);

  const moisLabel = MF[MK.indexOf(selMois as (typeof MK)[number])];

  return (
    <div className="pg">
      <div className="ph">
        <div className="ph-l">
          <h1>Encaissements</h1>
          <p>Paiements reçus sur tranches de factures</p>
        </div>
        <div className="ph-r">
          {/* Bouton principal : saisir un paiement */}
          {tranchesEnAttente.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button className="btn prim" onClick={() => setPayTranche(tranchesEnAttente[0])}>
                <Plus size={15} strokeWidth={2.5} />Saisir un paiement
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kr">
        <div className="kpi b">
          <div className="kpi-l">Total facturé TTC</div>
          <div className="kpi-v">{fmt(totalTTC)}</div>
          <div className="kpi-s">FCFA émis</div>
        </div>
        <div className="kpi g">
          <div className="kpi-l">Encaissé</div>
          <div className="kpi-v">{fmt(totalEnc)}</div>
          <div className="kpi-s">FCFA reçus</div>
        </div>
        <div className={`kpi ${enAttente > 0 ? 'r' : 'g'}`}>
          <div className="kpi-l">Solde en attente</div>
          <div className="kpi-v">{fmt(enAttente)}</div>
          <div className="kpi-s">FCFA à recevoir</div>
        </div>
        <div className="kpi t">
          <div className="kpi-l">Taux encaissement</div>
          <div className="kpi-v">{tauxEnc}%</div>
          <div className="kpi-s">
            <div className="prog" style={{ marginTop: 4 }}>
              <div className="prog-b" style={{ width: `${tauxEnc}%`, background: 'var(--T)' }} />
            </div>
          </div>
        </div>
        <div className="kpi p">
          <div className="kpi-l">Entrées banque</div>
          <div className="kpi-v">{fmt(totalBanque)}</div>
          <div className="kpi-s">FCFA crédités</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        <button className={`tab${tab === 'mois'    ? ' on' : ''}`} onClick={() => setTab('mois')}>Par mois</button>
        <button className={`tab${tab === 'mission' ? ' on' : ''}`} onClick={() => setTab('mission')}>Par mission</button>
        <button className={`tab${tab === 'banque'  ? ' on' : ''}`} onClick={() => setTab('banque')}>Entrées banque</button>
      </div>

      {/* ════════════════════════════════════════════════════════════
          Tab 1 — PAR MOIS
      ════════════════════════════════════════════════════════════ */}
      {tab === 'mois' && (
        <>
          <div className="pb">
            {MK.map((k, i) => (
              <button key={k} className={`pb-btn${selMois === k ? ' on' : ''}`} onClick={() => setSelMois(k)}>
                {MF[i].slice(0, 3)}
              </button>
            ))}
          </div>

          {fLoad || fErr
            ? <QueryCard isLoading={fLoad} error={fErr} />
            : <>
              {/* Résumé mois */}
              <div className="g2" style={{ marginBottom: 14 }}>
                <div className="kpi g">
                  <div className="kpi-l">Reçu en {moisLabel}</div>
                  <div className="kpi-v">{fmt(totalRecuMois)}</div>
                  <div className="kpi-s">{recuCeMois.length} paiement{recuCeMois.length !== 1 ? 's' : ''}</div>
                </div>
                <div className={`kpi ${totalPrevuMois > 0 ? 'r' : 'g'}`}>
                  <div className="kpi-l">Attendu non reçu</div>
                  <div className="kpi-v">{fmt(totalPrevuMois)}</div>
                  <div className="kpi-s">{prevuCeMois.length} tranche{prevuCeMois.length !== 1 ? 's' : ''} en attente</div>
                </div>
              </div>

              {/* Paiements reçus */}
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="ch">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} strokeWidth={2} color="var(--G)" />
                    Paiements reçus — {moisLabel}
                  </h3>
                </div>
                <div className="tw">
                  <table>
                    <thead>
                      <tr>
                        <th>Mission</th><th>Client</th><th>N° Facture</th><th>Tranche</th>
                        <th className="tr">Montant prévu</th><th className="tr">Encaissé</th>
                        <th>Date enc.</th><th>Référence</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recuCeMois.length === 0
                        ? <tr><td colSpan={9} className="empty">Aucun paiement enregistré ce mois</td></tr>
                        : recuCeMois.map(t => (
                          <tr key={t.id}>
                            <td className="fw7">{t.misNom}</td>
                            <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{t.client}</td>
                            <td><span className="pc-num">{t.facNum}</span></td>
                            <td style={{ fontSize: 11 }}>Tranche {t.num}</td>
                            <td className="tnum">{fmt(t.montant)}</td>
                            <td className="tnum fw7 tc">{fmt(t.encaisse)}</td>
                            <td style={{ fontSize: 11 }}>{t.dateEnc?.slice(0, 10) ?? '—'}</td>
                            <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{t.ref ?? '—'}</td>
                            <td>
                              <button className="ibt" title="Modifier" onClick={() => setPayTranche(t)}>
                                <CreditCard size={13} strokeWidth={2} />
                              </button>
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                    {recuCeMois.length > 0 && (
                      <tfoot>
                        <tr style={{ background: 'var(--sur2)', borderTop: '2px solid var(--bor2)' }}>
                          <td colSpan={4} className="fw7" style={{ padding: '7px 10px', fontSize: 12 }}>TOTAL REÇU</td>
                          <td className="tnum fw7">{fmt(recuCeMois.reduce((s, t) => s + t.montant, 0))}</td>
                          <td className="tnum fw7 tc">{fmt(totalRecuMois)}</td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Attendus non reçus */}
              <div className="card">
                <div className="ch fb">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={14} strokeWidth={2} color={prevuCeMois.length > 0 ? 'var(--R)' : 'var(--tx3)'} />
                    Attendus non reçus — {moisLabel}
                  </h3>
                  {prevuCeMois.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--R)', fontWeight: 600 }}>
                      {fmt(totalPrevuMois)} FCFA en attente
                    </span>
                  )}
                </div>
                <div className="tw">
                  <table>
                    <thead>
                      <tr>
                        <th>Mission</th><th>Client</th><th>N° Facture</th><th>Tranche</th>
                        <th className="tr">Montant</th><th>Échéance</th><th>Statut</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {prevuCeMois.length === 0
                        ? <tr><td colSpan={8} className="empty" style={{ color: 'var(--G)' }}>
                            <CheckCircle2 size={12} strokeWidth={2} style={{ display: 'inline', marginRight: 5 }} />
                            Tout a été encaissé ce mois
                          </td></tr>
                        : prevuCeMois.map(t => (
                          <tr key={t.id} style={{ background: 'var(--Rl)' }}>
                            <td className="fw7">{t.misNom}</td>
                            <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{t.client}</td>
                            <td><span className="pc-num">{t.facNum}</span></td>
                            <td style={{ fontSize: 11 }}>Tranche {t.num}</td>
                            <td className="tnum fw7 rc">{fmt(t.montant)}</td>
                            <td style={{ fontSize: 11, color: 'var(--R)', fontWeight: 700 }}>
                              {t.echeance.slice(0, 10)}
                            </td>
                            <td><StatusBadge t={t} /></td>
                            <td>
                              <button className="btn xs prim" style={{ gap: 4 }} onClick={() => setPayTranche(t)}>
                                <CreditCard size={12} strokeWidth={2} />Saisir
                              </button>
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          }
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          Tab 2 — PAR MISSION
      ════════════════════════════════════════════════════════════ */}
      {tab === 'mission' && (
        <div className="card">
          <div className="ch"><h3>Synthèse encaissements par mission</h3></div>
          {fLoad || fErr
            ? <div className="cb"><QueryCard isLoading={fLoad} error={fErr} /></div>
            : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Mission</th><th>Client</th>
                      <th className="tr">Facturé TTC</th>
                      <th className="tr">Encaissé</th>
                      <th className="tr">Solde</th>
                      <th>Progression</th>
                      <th>Tranches</th>
                      <th>Dernier enc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byMission.length === 0
                      ? <tr><td colSpan={8} className="empty">Aucune facture enregistrée</td></tr>
                      : byMission.map(m => {
                        const pct   = m.ttc > 0 ? Math.round(m.enc / m.ttc * 100) : 0;
                        const solde = m.ttc - m.enc;
                        const done  = pct >= 100;
                        return (
                          <tr key={m.misId}>
                            <td className="fw7">{m.nom}</td>
                            <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{m.client}</td>
                            <td className="tnum">{fmt(m.ttc)}</td>
                            <td className="tnum tc fw7">{fmt(m.enc)}</td>
                            <td className={`tnum ${solde > 0 ? 'rc' : 'tc'}`}>{fmt(solde)}</td>
                            <td style={{ minWidth: 120 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div className="prog" style={{ flex: 1 }}>
                                  <div className="prog-b" style={{
                                    width: `${pct}%`,
                                    background: done ? 'var(--G)' : pct > 50 ? 'var(--T)' : 'var(--A)',
                                  }} />
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--tx3)', flexShrink: 0, fontFamily: 'var(--fm)' }}>{pct}%</span>
                              </div>
                            </td>
                            <td><span className="bdg bn">{m.nbSoldees}/{m.nbTranches}</span></td>
                            <td style={{ fontSize: 11, color: 'var(--tx3)' }}>
                              {m.lastEnc ? m.lastEnc.slice(0, 10) : '—'}
                            </td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                  {byMission.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'var(--sur2)', borderTop: '2px solid var(--bor2)' }}>
                        <td colSpan={2} className="fw7" style={{ padding: '7px 10px', fontSize: 12 }}>TOTAL</td>
                        <td className="tnum fw7">{fmt(totalTTC)}</td>
                        <td className="tnum fw7 tc">{fmt(totalEnc)}</td>
                        <td className={`tnum fw7 ${enAttente > 0 ? 'rc' : 'tc'}`}>{fmt(enAttente)}</td>
                        <td colSpan={3}>
                          <span style={{ fontSize: 11, fontFamily: 'var(--fm)', fontWeight: 700, color: 'var(--T)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <TrendingUp size={12} strokeWidth={2} />{tauxEnc}% global
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          Tab 3 — ENTRÉES BANQUE
      ════════════════════════════════════════════════════════════ */}
      {tab === 'banque' && (
        <div className="card">
          <div className="ch fb">
            <h3>Entrées banque brutes</h3>
            <span className="bdg bg">Total crédits : {fmt(totalBanque)} FCFA</span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Période</th><th>Intitulé / Réf.</th>
                  <th>Désignation</th><th>Prestataire</th>
                  <th className="tr">Crédit (FCFA)</th><th>Catégorie</th>
                </tr>
              </thead>
              <tbody>
                {entreesBanque.length === 0
                  ? <tr><td colSpan={7} className="empty">Aucune entrée bancaire</td></tr>
                  : entreesBanque.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontSize: 11 }}>{d.date.slice(0, 10)}</td>
                      <td style={{ fontSize: 11 }}>{d.periode ?? '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--tx3)' }}>
                        {[d.intitule, d.reference].filter(Boolean).join(' — ') || '—'}
                      </td>
                      <td className="fw7">{d.designation}</td>
                      <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{d.prestataire ?? '—'}</td>
                      <td className="tnum fw7 tc">{fmt(d.credit)}</td>
                      <td><span className="bdg bn">{d.categorie ?? '—'}</span></td>
                    </tr>
                  ))
                }
              </tbody>
              {entreesBanque.length > 1 && (
                <tfoot>
                  <tr style={{ background: 'var(--sur2)', borderTop: '2px solid var(--bor2)' }}>
                    <td colSpan={5} className="fw7" style={{ padding: '7px 10px', fontSize: 12 }}>TOTAL</td>
                    <td className="tnum fw7 tc">{fmt(totalBanque)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Modal paiement (global) ── */}
      <PayModal tranche={payTranche} onClose={() => setPayTranche(null)} />
    </div>
  );
}
