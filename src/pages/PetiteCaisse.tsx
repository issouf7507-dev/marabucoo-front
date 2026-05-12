import { useRef, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
  des: '', prest: '', entree: 0, sortie: 0, pen: 0,
};

export default function PetiteCaisse() {
  const chartRef  = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<Chart | null>(null);

  const [period, setPeriod]       = useState('AVRIL');
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

  const totalEntrees = all.filter(p => p.type === 'entree').reduce((s, p) => s + p.entree, 0);
  const totalSorties = all.filter(p => p.type === 'sortie').reduce((s, p) => s + p.sortie, 0);
  const lastSolde    = all.length > 0 ? all[all.length - 1].solde : 0;
  const soldeFiltre  = filtered.reduce((s, p) => s + p.entree - p.sortie - p.penalite, 0);

  useEffect(() => {
    chartInst.current?.destroy();
    const activeMois = PERIODES.filter(p => all.some(x => x.periode === p));
    const labels = activeMois.length > 0 ? activeMois : PERIODES;
    const caisses = ['PRINCIPALE', 'BEN SOUDA'];
    const datasets = caisses.map((c, i) => ({
      label: c,
      data: labels.map(per => all.filter(x => x.caisse === c && x.periode === per).reduce((s, x) => s + x.sortie, 0)),
      backgroundColor: i === 0 ? 'rgba(27,94,64,.55)' : 'rgba(26,78,138,.55)',
      borderColor: i === 0 ? '#1B5E40' : '#1A4E8A',
      borderWidth: 1,
    }));
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
      caisse:  p.caisse      as PetiteCaisseInput['caisse'],
      type:    p.type        as PetiteCaisseInput['type'],
      cat:     p.categorie   ?? '',
      nature:  p.nature      as PetiteCaisseInput['nature'],
      per:     p.periode     ?? '',
      date:    p.date?.slice(0, 10) ?? '',
      des:     p.designation,
      prest:   p.prestataire ?? '',
      entree:  p.entree,
      sortie:  p.sortie,
      pen:     p.penalite,
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

  const isSaving  = createMutation.isPending || updateMutation.isPending;
  const isEntree  = form.values.type === 'entree';

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

      <div className="kr">
        <div className="kpi g">
          <div className="kpi-l">Solde actuel</div>
          <div className="kpi-v">{fmt(lastSolde)}</div>
          <div className="kpi-s">FCFA en caisse</div>
        </div>
        <div className="kpi g">
          <div className="kpi-l">Total entrées</div>
          <div className="kpi-v">{fmt(totalEntrees)}</div>
          <div className="kpi-s">FCFA dotations</div>
        </div>
        <div className="kpi r">
          <div className="kpi-l">Total sorties</div>
          <div className="kpi-v">{fmt(totalSorties)}</div>
          <div className="kpi-s">FCFA dépensés</div>
        </div>
        <div className="kpi b">
          <div className="kpi-l">Opérations</div>
          <div className="kpi-v">{all.length}</div>
          <div className="kpi-s">pièces de caisse</div>
        </div>
      </div>

      <div className="pb">
        {PERIODES.map(p => (
          <button key={p} className={`pb-btn${period === p ? ' on' : ''}`} onClick={() => setPeriod(p)}>
            {p}
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
                <th>Entrée</th><th>Sortie</th><th>Pénalité</th><th>Solde</th><th></th>
              </tr>
            </thead>
            <tbody>
              <QueryRows isLoading={isLoading} error={error} colSpan={12} />
              {!isLoading && !error && (
                filtered.length === 0
                  ? <tr><td colSpan={12} className="empty">Aucune opération</td></tr>
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
                      <td className="tnum tc">{p.entree > 0 ? fmt(p.entree) : '—'}</td>
                      <td className="tnum rc">{p.sortie > 0 ? fmt(p.sortie) : '—'}</td>
                      <td className="tnum" style={{ color: 'var(--tx3)' }}>{p.penalite > 0 ? fmt(p.penalite) : '—'}</td>
                      <td className="tnum fw7">{fmt(p.solde)}</td>
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
        {!isLoading && !error && soldeFiltre !== 0 && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--bor)', fontSize: 12 }}>
            <span className="fw7">Mouvement net période : </span>
            <span className={soldeFiltre >= 0 ? 'tc' : 'rc'}>{fmt(soldeFiltre)} FCFA</span>
          </div>
        )}
      </div>

      <div className="card">
        <div className="ch"><h3>Flux petite caisse par mois et par caisse</h3></div>
        {isLoading || error
          ? <div className="cb"><QueryCard isLoading={isLoading} error={error} /></div>
          : <div className="cb"><div className="cw" style={{ height: 190 }}><canvas ref={chartRef} /></div></div>
        }
      </div>

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
            onChange={e => form.set('type', e.target.value as PetiteCaisseInput['type'])}>
            <option value="sortie">Sortie</option>
            <option value="entree">Entrée</option>
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
              <Field label="Montant sortie (FCFA) *" type="number" value={form.values.sortie}
                error={form.errors.entree} onChange={e => form.set('sortie', +e.target.value)} />
            )
          }
          <Field label="Pénalité" type="number" value={form.values.pen}
            onChange={e => form.set('pen', +e.target.value)} />
          {saveError && (
            <div className="alert r" style={{ marginTop: 4 }}>{saveError}</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
