import { useRef, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import { fmt } from '../utils/format';
import { petiteCaisseSchema, type PetiteCaisseInput } from '../schemas';
import { useForm } from '../hooks/useForm';
import { usePetiteCaisse, useCreatePC, useUpdatePC, useDeletePC } from '../hooks/queries/usePetiteCaisse';
import Modal from '../components/ui/Modal';
import Field from '../components/ui/Field';
import { QueryRows, QueryCard } from '../components/ui/QueryState';
import type { ApiPetiteCaisse } from '../services/petitecaisse.service';

Chart.register(...registerables);

const PERIODES = [
  'JANVIER','FEVRIER','MARS','AVRIL','MAI','JUIN',
  'JUILLET','AOUT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DECEMBRE',
];

const CATEGORIES = [
  "CHARGES D'EXPLOITATION",
  'RESSOURCES HUMAINES',
  'MISSION',
  'AUTRE',
];

const initial: PetiteCaisseInput = {
  caisse: 'PRINCIPALE', type: 'sortie', cat: "CHARGES D'EXPLOITATION",
  nature: 'prevu', per: 'AVRIL',
  date: new Date().toISOString().slice(0, 10),
  des: '', prest: '', entree: 0, sortie: 0, pen: 0, refFacture: '',
};

type Tab = 'registre' | 'factures';

export default function PetiteCaisse() {
  const chartRef  = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<Chart | null>(null);

  const [tab, setTab]             = useState<Tab>('registre');
  const [period, setPeriod]       = useState('');
  const [filCaisse, setFilCaisse] = useState('');

  const { data: all = [], isLoading, error } = usePetiteCaisse();
  const createMutation = useCreatePC();
  const updateMutation = useUpdatePC();
  const deleteMutation = useDeletePC();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId]       = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const form = useForm(petiteCaisseSchema, initial);

  const filtered = all.filter(p =>
    (!period    || p.periode === period) &&
    (!filCaisse || p.caisse  === filCaisse)
  );

  // Current balance per caisse (last solde of each)
  const soldeParCaisse = ['PRINCIPALE', 'BEN SOUDA'].map(c => {
    const rows = all.filter(x => x.caisse === c);
    return { caisse: c, solde: rows.length > 0 ? rows[rows.length - 1].solde : 0 };
  });
  const soldeTotal = soldeParCaisse.reduce((s, x) => s + x.solde, 0);

  const totalEntrees = all.filter(p => p.type === 'entree').reduce((s, p) => s + p.entree, 0);
  const totalSorties = all.filter(p => p.type === 'sortie').reduce((s, p) => s + p.sortie + p.penalite, 0);

  // Factures tab: entries that have a refFacture set
  const factures = all.filter(p => p.refFacture && p.refFacture.trim() !== '');

  useEffect(() => {
    chartInst.current?.destroy();
    const labels = PERIODES.map(p => p.slice(0, 3));
    const datasets = [
      {
        label: 'PRINCIPALE — Entrées',
        data: PERIODES.map(per => all.filter(x => x.caisse === 'PRINCIPALE' && x.periode === per).reduce((s, x) => s + x.entree, 0)),
        backgroundColor: 'rgba(27,94,64,.65)',
        borderColor: '#1B5E40',
        borderWidth: 1,
      },
      {
        label: 'PRINCIPALE — Sorties',
        data: PERIODES.map(per => all.filter(x => x.caisse === 'PRINCIPALE' && x.periode === per).reduce((s, x) => s + x.sortie + x.penalite, 0)),
        backgroundColor: 'rgba(220,38,38,.65)',
        borderColor: '#dc2626',
        borderWidth: 1,
      },
      {
        label: 'BEN SOUDA — Entrées',
        data: PERIODES.map(per => all.filter(x => x.caisse === 'BEN SOUDA' && x.periode === per).reduce((s, x) => s + x.entree, 0)),
        backgroundColor: 'rgba(26,78,138,.65)',
        borderColor: '#1A4E8A',
        borderWidth: 1,
      },
      {
        label: 'BEN SOUDA — Sorties',
        data: PERIODES.map(per => all.filter(x => x.caisse === 'BEN SOUDA' && x.periode === per).reduce((s, x) => s + x.sortie + x.penalite, 0)),
        backgroundColor: 'rgba(234,88,12,.65)',
        borderColor: '#ea580c',
        borderWidth: 1,
      },
    ];
    if (chartRef.current) {
      chartInst.current = new Chart(chartRef.current, {
        type: 'bar',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
          scales: { y: { ticks: { callback: (v: unknown) => Math.round(Number(v) / 1000) + 'K', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,.04)' } } },
        },
      });
    }
    return () => { chartInst.current?.destroy(); };
  }, [all]);

  function openNew() {
    setEditId(null);
    setSaveError(null);
    form.reset({ ...initial, per: period || 'AVRIL' });
    setModalOpen(true);
  }

  function openEdit(p: ApiPetiteCaisse) {
    setSaveError(null);
    setEditId(p.id);
    form.reset({
      caisse:     p.caisse      as PetiteCaisseInput['caisse'],
      type:       p.type        as PetiteCaisseInput['type'],
      cat:        p.categorie   ?? '',
      nature:     p.nature      as PetiteCaisseInput['nature'],
      per:        p.periode     ?? '',
      date:       p.date?.slice(0, 10) ?? '',
      des:        p.designation,
      prest:      p.prestataire ?? '',
      entree:     p.entree,
      sortie:     p.sortie,
      pen:        p.penalite,
      refFacture: p.refFacture  ?? '',
    });
    setModalOpen(true);
  }

  async function save() {
    setSaveError(null);
    if (!form.validate()) return;
    try {
      if (editId) await updateMutation.mutateAsync({ id: editId, data: form.values });
      else        await createMutation.mutateAsync(form.values);
      setModalOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur lors de l\'enregistrement');
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isEntree = form.values.type === 'entree';

  return (
    <div className="pg">
      <div className="ph">
        <div className="ph-l">
          <h1>Petite caisse</h1>
          <p>Gestion séparée — numérotation automatique pour archivage physique</p>
        </div>
        <div className="ph-r">
          <button className="btn prim" onClick={openNew}>
            <Plus size={15} strokeWidth={2.5} />Nouvelle opération
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kr">
        <div className={`kpi ${soldeTotal >= 0 ? 'g' : 'r'}`}>
          <div className="kpi-l">Solde total caisse</div>
          <div className="kpi-v">{fmt(soldeTotal)}</div>
          <div className="kpi-s">FCFA en caisse</div>
        </div>
        {soldeParCaisse.map(({ caisse, solde }) => (
          <div key={caisse} className={`kpi ${solde >= 0 ? 'g' : 'r'}`}>
            <div className="kpi-l">{caisse === 'PRINCIPALE' ? 'Caisse principale' : 'Caisse Ben Souda'}</div>
            <div className="kpi-v">{fmt(solde)}</div>
            <div className="kpi-s">FCFA</div>
          </div>
        ))}
        <div className="kpi g">
          <div className="kpi-l">Total entrées</div>
          <div className="kpi-v">{fmt(totalEntrees)}</div>
          <div className="kpi-s">FCFA dotations</div>
        </div>
        <div className="kpi r">
          <div className="kpi-l">Total sorties</div>
          <div className="kpi-v">{fmt(totalSorties)}</div>
          <div className="kpi-s">FCFA dépensés + pénalités</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab${tab === 'registre'  ? ' on' : ''}`} onClick={() => setTab('registre')}>Registre</button>
        <button className={`tab${tab === 'factures'  ? ' on' : ''}`} onClick={() => setTab('factures')}>
          <FileText size={13} strokeWidth={2} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
          Factures
          {factures.length > 0 && (
            <span className="bdg bg" style={{ marginLeft: 6, fontSize: 9 }}>{factures.length}</span>
          )}
        </button>
      </div>

      {/* ── Tab Registre ── */}
      {tab === 'registre' && (
        <>
          <div className="pb">
            {PERIODES.map(p => (
              <button key={p} className={`pb-btn${period === p ? ' on' : ''}`} onClick={() => setPeriod(p)}>
                {p.slice(0, 3)}
              </button>
            ))}
            <button className={`pb-btn${period === '' ? ' on' : ''}`} onClick={() => setPeriod('')}>TOUT</button>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch fb">
              <h3>Registre petite caisse</h3>
              <select className="sel" value={filCaisse} onChange={e => setFilCaisse(e.target.value)} style={{ width: 170 }}>
                <option value="">Toutes caisses</option>
                <option value="PRINCIPALE">Caisse principale</option>
                <option value="BEN SOUDA">Caisse Ben Souda</option>
              </select>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>N° Pièce</th><th>Date</th><th>Caisse</th><th>Type</th><th>Catégorie</th>
                    <th>Désignation</th><th>Prestataire</th>
                    <th className="tr">Entrée</th><th className="tr">Sortie</th><th className="tr">Pénalité</th>
                    <th className="tr">Solde</th><th>Réf. facture</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  <QueryRows isLoading={isLoading} error={error} colSpan={13} />
                  {!isLoading && !error && (
                    filtered.length === 0
                      ? <tr><td colSpan={13} className="empty">Aucune opération</td></tr>
                      : filtered.map(p => (
                        <tr key={p.id}>
                          <td className="mono" style={{ fontSize: 11 }}>{p.num}</td>
                          <td style={{ fontSize: 11 }}>{p.date?.slice(0, 10)}</td>
                          <td><span className="bdg bb">{p.caisse}</span></td>
                          <td>
                            <span className={`bdg ${p.type === 'entree' ? 'bg' : 'br'}`}>
                              {p.type === 'entree' ? '↑ Entrée' : '↓ Sortie'}
                            </span>
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{p.categorie ?? '—'}</td>
                          <td style={{ fontSize: 11.5 }}>{p.designation}</td>
                          <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{p.prestataire ?? '—'}</td>
                          <td className="tnum" style={{ color: 'var(--G)', fontWeight: p.entree > 0 ? 700 : undefined }}>
                            {p.entree > 0 ? `+${fmt(p.entree)}` : '—'}
                          </td>
                          <td className="tnum" style={{ color: 'var(--R)', fontWeight: p.sortie > 0 ? 700 : undefined }}>
                            {p.sortie > 0 ? `-${fmt(p.sortie)}` : '—'}
                          </td>
                          <td className="tnum" style={{ color: 'var(--tx3)' }}>{p.penalite > 0 ? fmt(p.penalite) : '—'}</td>
                          <td className="tnum fw7" style={{ color: p.solde >= 0 ? 'var(--G)' : 'var(--R)' }}>
                            {fmt(p.solde)}
                          </td>
                          <td style={{ fontSize: 10, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>
                            {p.refFacture ?? '—'}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="ibt" title="Modifier" onClick={() => openEdit(p)}>
                              <Pencil size={13} strokeWidth={2} />
                            </button>
                            <button className="ibt del" title="Supprimer"
                              onClick={() => { if (confirm('Supprimer cette opération ?')) deleteMutation.mutate(p.id); }}>
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

          <div className="card">
            <div className="ch"><h3>Flux petite caisse par mois et par caisse</h3></div>
            {isLoading || error
              ? <div className="cb"><QueryCard isLoading={isLoading} error={error} /></div>
              : (
                <>
                  <div className="cb"><div className="cw" style={{ height: 220 }}><canvas ref={chartRef} /></div></div>
                  <div className="tw" style={{ marginTop: 16 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Mois</th>
                          <th className="tr" style={{ color: 'var(--G)' }}>PRINCIPALE Entrées</th>
                          <th className="tr" style={{ color: 'var(--R)' }}>PRINCIPALE Sorties</th>
                          <th className="tr" style={{ color: '#1A4E8A' }}>BEN SOUDA Entrées</th>
                          <th className="tr" style={{ color: '#ea580c' }}>BEN SOUDA Sorties</th>
                          <th className="tr">Net mois</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PERIODES.map(per => {
                          const pE = all.filter(x => x.caisse === 'PRINCIPALE' && x.periode === per).reduce((s, x) => s + x.entree, 0);
                          const pS = all.filter(x => x.caisse === 'PRINCIPALE' && x.periode === per).reduce((s, x) => s + x.sortie + x.penalite, 0);
                          const bE = all.filter(x => x.caisse === 'BEN SOUDA'   && x.periode === per).reduce((s, x) => s + x.entree, 0);
                          const bS = all.filter(x => x.caisse === 'BEN SOUDA'   && x.periode === per).reduce((s, x) => s + x.sortie + x.penalite, 0);
                          const net = pE - pS + bE - bS;
                          return (
                            <tr key={per}>
                              <td style={{ fontWeight: 600 }}>{per.slice(0, 3)}</td>
                              <td className="tnum" style={{ color: 'var(--G)' }}>{pE > 0 ? `+${fmt(pE)}` : '—'}</td>
                              <td className="tnum" style={{ color: 'var(--R)' }}>{pS > 0 ? `-${fmt(pS)}` : '—'}</td>
                              <td className="tnum" style={{ color: '#1A4E8A' }}>{bE > 0 ? `+${fmt(bE)}` : '—'}</td>
                              <td className="tnum" style={{ color: '#ea580c' }}>{bS > 0 ? `-${fmt(bS)}` : '—'}</td>
                              <td className="tnum fw7" style={{ color: net > 0 ? 'var(--G)' : net < 0 ? 'var(--R)' : 'var(--tx3)' }}>
                                {net !== 0 ? fmt(net) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            }
          </div>
        </>
      )}

      {/* ── Tab Factures ── */}
      {tab === 'factures' && (
        <div className="card">
          <div className="ch fb">
            <h3>Factures & Pièces justificatives</h3>
            <button className="btn prim" onClick={() => { form.reset({ ...initial, refFacture: '' }); setEditId(null); setSaveError(null); setModalOpen(true); }}>
              <Plus size={15} strokeWidth={2.5} />Nouvelle pièce
            </button>
          </div>
          {isLoading || error
            ? <div className="cb"><QueryCard isLoading={isLoading} error={error} /></div>
            : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Réf. facture</th><th>N° Pièce</th><th>Date</th><th>Caisse</th>
                      <th>Désignation</th><th>Prestataire</th>
                      <th className="tr">Montant</th><th>Type</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {factures.length === 0
                      ? <tr><td colSpan={9} className="empty">Aucune pièce justificative enregistrée — ajoutez une référence facture lors de la saisie</td></tr>
                      : factures.map(p => (
                        <tr key={p.id}>
                          <td>
                            <span className="bdg bb" style={{ fontFamily: 'var(--fm)', fontSize: 11 }}>
                              <FileText size={10} strokeWidth={2} style={{ display: 'inline', marginRight: 3 }} />
                              {p.refFacture}
                            </span>
                          </td>
                          <td className="mono" style={{ fontSize: 11 }}>{p.num}</td>
                          <td style={{ fontSize: 11 }}>{p.date?.slice(0, 10)}</td>
                          <td><span className="bdg bn">{p.caisse}</span></td>
                          <td style={{ fontSize: 11.5 }}>{p.designation}</td>
                          <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{p.prestataire ?? '—'}</td>
                          <td className="tnum fw7" style={{ color: p.type === 'entree' ? 'var(--G)' : 'var(--R)' }}>
                            {p.type === 'entree' ? `+${fmt(p.entree)}` : `-${fmt(p.sortie)}`}
                          </td>
                          <td>
                            <span className={`bdg ${p.type === 'entree' ? 'bg' : 'br'}`}>
                              {p.type === 'entree' ? 'Entrée' : 'Sortie'}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="ibt" title="Modifier" onClick={() => openEdit(p)}>
                              <Pencil size={13} strokeWidth={2} />
                            </button>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* ── Modal ── */}
      <Modal
        open={modalOpen}
        title={editId ? "Modifier l'opération" : 'Nouvelle opération de caisse'}
        onClose={() => setModalOpen(false)}
        onSave={save}
        saving={isSaving}
        saveLabel={isSaving ? 'Enregistrement…' : 'Enregistrer'}
        width={580}
      >
        <div className="fg">
          <Field as="select" label="Caisse *" value={form.values.caisse} error={form.errors.caisse}
            onChange={e => form.set('caisse', e.target.value as PetiteCaisseInput['caisse'])}>
            <option value="PRINCIPALE">Caisse principale</option>
            <option value="BEN SOUDA">Caisse Ben Souda</option>
          </Field>
          <Field as="select" label="Type *" value={form.values.type} error={form.errors.type}
            onChange={e => {
              const t = e.target.value as PetiteCaisseInput['type'];
              form.set('type', t);
              // reset the other amount to avoid double-counting
              if (t === 'entree') form.set('sortie', 0);
              else form.set('entree', 0);
            }}>
            <option value="sortie">↓ Sortie</option>
            <option value="entree">↑ Entrée</option>
          </Field>
          <Field as="select" label="Nature" value={form.values.nature}
            onChange={e => form.set('nature', e.target.value as PetiteCaisseInput['nature'])}>
            <option value="prevu">Prévu</option>
            <option value="imprevu">Imprévu</option>
          </Field>
          <Field label="Date *" type="date" value={form.values.date} error={form.errors.date}
            onChange={e => form.set('date', e.target.value)} />
          <Field as="select" label="Période" value={form.values.per}
            onChange={e => form.set('per', e.target.value)}>
            <option value="">—</option>
            {PERIODES.map(p => <option key={p} value={p}>{p}</option>)}
          </Field>
          <Field full label="Désignation *" value={form.values.des} error={form.errors.des}
            onChange={e => form.set('des', e.target.value)} placeholder="Ex : Approvisionnement carburant" />
          <Field as="select" label="Catégorie" value={form.values.cat}
            onChange={e => form.set('cat', e.target.value)}>
            <option value="">—</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Field>
          <Field label="Prestataire" value={form.values.prest}
            onChange={e => form.set('prest', e.target.value)} />
          {isEntree
            ? (
              <Field label="Montant entrée (FCFA) *" type="number" value={form.values.entree}
                error={form.errors.entree} onChange={e => form.set('entree', +e.target.value)} />
            ) : (
              <>
                <Field label="Montant sortie (FCFA) *" type="number" value={form.values.sortie}
                  error={form.errors.entree} onChange={e => form.set('sortie', +e.target.value)} />
                <Field label="Pénalité (FCFA)" type="number" value={form.values.pen}
                  onChange={e => form.set('pen', +e.target.value)} />
              </>
            )
          }
          <Field full label="Référence facture" value={form.values.refFacture}
            onChange={e => form.set('refFacture', e.target.value)}
            placeholder="Ex : FACT-2026-042 ou reçu n°12" />
          {saveError && (
            <div className="alert r" style={{ marginTop: 4 }}>{saveError}</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
