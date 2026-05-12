import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { fmt } from '../utils/format';
import { depenseSchema, type DepenseInput } from '../schemas';
import { useForm } from '../hooks/useForm';
import { useDepenses, useCreateDepense, useUpdateDepense, useDeleteDepense } from '../hooks/queries/useDepenses';
import Modal from '../components/ui/Modal';
import Field from '../components/ui/Field';
import { QueryRows } from '../components/ui/QueryState';
import type { ApiDepense } from '../services/depenses.service';

const PERIODES = [
  'JANVIER','FEVRIER','MARS','AVRIL','MAI','JUIN',
  'JUILLET','AOUT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DECEMBRE',
];

const CATEGORIES = [
  { value: 'RESSOURCES HUMAINES',     label: 'Ressources humaines' },
  { value: 'MISSION',                 label: 'Mission' },
  { value: 'HONORAIRES MISSIONS',     label: 'Honoraires missions' },
  { value: "CHARGES D'EXPLOITATION",  label: "Charges d'exploitation" },
  { value: 'FRAIS DE TENUE DE COMPTE',label: 'Frais bancaires' },
  { value: 'A VOIR',                  label: 'À classer' },
];

const initial: DepenseInput = {
  type: 'SORTIE BANQUE', cat: '', per: '', int: '',
  date: new Date().toISOString().slice(0, 10),
  des: '', prest: '', mnt: 0, ft: 0, pen: 0, ref: '', nature: 'prevu',
};

export default function Depenses() {
  const [period, setPeriod]   = useState('AVRIL');
  const [filType, setFilType] = useState('');
  const [filCat, setFilCat]   = useState('');

  const { data: depenses = [], isLoading, error } = useDepenses(period || undefined);
  const createMutation = useCreateDepense();
  const updateMutation = useUpdateDepense();
  const deleteMutation = useDeleteDepense();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId]       = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const form = useForm(depenseSchema, initial);

  const filtered = depenses.filter(d =>
    (!filType || d.type === filType) &&
    (!filCat  || d.categorie === filCat)
  );

  const totalCredits = filtered.filter(d => d.type === 'ENTREE BANQUE').reduce((s, d) => s + d.montant, 0);
  const totalDebits  = filtered.filter(d => d.type === 'SORTIE BANQUE').reduce((s, d) => s + d.montant,  0);

  function openNew() {
    setEditId(null);
    setSaveError(null);
    form.reset({ ...initial, per: period });
    setModalOpen(true);
  }

  function openEdit(d: ApiDepense) {
    setSaveError(null);
    setEditId(d.id);
    form.reset({
      type:   d.type as DepenseInput['type'],
      cat:    d.categorie   ?? '',
      per:    d.periode     ?? '',
      int:    d.intitule    ?? '',
      date:   d.date?.slice(0, 10) ?? '',
      des:    d.designation,
      prest:  d.prestataire ?? '',
      mnt:    d.montant,
      ft:     d.fraisTransf,
      pen:    d.penalite,
      ref:    d.reference   ?? '',
      nature: d.nature as DepenseInput['nature'],
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
      setSaveError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="pg">
      <div className="ph">
        <div className="ph-l">
          <h1>Dépenses banque</h1>
          <p>Journal des opérations bancaires — sorties et entrées</p>
        </div>
        <div className="ph-r">
          <button className="btn prim" onClick={openNew}>
            <Plus size={15} strokeWidth={2.5} />Nouvelle opération
          </button>
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

      <div className="kr">
        <div className="kpi g">
          <div className="kpi-l">Entrées banque</div>
          <div className="kpi-v">{fmt(totalCredits)}</div>
          <div className="kpi-s">FCFA crédités</div>
        </div>
        <div className="kpi r">
          <div className="kpi-l">Sorties banque</div>
          <div className="kpi-v">{fmt(totalDebits)}</div>
          <div className="kpi-s">FCFA débités</div>
        </div>
        <div className={`kpi ${totalCredits - totalDebits >= 0 ? 'g' : 'r'}`}>
          <div className="kpi-l">Solde période</div>
          <div className="kpi-v">{fmt(totalCredits - totalDebits)}</div>
          <div className="kpi-s">FCFA net</div>
        </div>
        <div className="kpi b">
          <div className="kpi-l">Opérations</div>
          <div className="kpi-v">{filtered.length}</div>
          <div className="kpi-s">lignes</div>
        </div>
      </div>

      <div className="card">
        <div className="ch fb">
          <h3>Journal bancaire</h3>
          <div className="fr2">
            <select className="sel" value={filType} onChange={e => setFilType(e.target.value)} style={{ width: 150 }}>
              <option value="">Tous types</option>
              <option value="SORTIE BANQUE">Sorties banque</option>
              <option value="ENTREE BANQUE">Entrées banque</option>
            </select>
            <select className="sel" value={filCat} onChange={e => setFilCat(e.target.value)} style={{ width: 175 }}>
              <option value="">Toutes catégories</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Période</th><th>Type</th><th>Catégorie</th>
                <th>Désignation</th><th>Prestataire</th><th>Montant</th>
                <th>Frais transf.</th><th>Référence</th><th></th>
              </tr>
            </thead>
            <tbody>
              <QueryRows isLoading={isLoading} error={error} colSpan={10} />
              {!isLoading && !error && (
                filtered.length === 0
                  ? <tr><td colSpan={10} className="empty">Aucune opération</td></tr>
                  : filtered.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontSize: 11 }}>{d.date?.slice(0, 10)}</td>
                      <td style={{ fontSize: 11 }}>{d.periode ?? '—'}</td>
                      <td>
                        <span className={`bdg ${d.type === 'ENTREE BANQUE' ? 'bg' : 'br'}`} style={{ fontSize: 9.5 }}>
                          {d.type === 'ENTREE BANQUE' ? '↑ Entrée' : '↓ Sortie'}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{d.categorie ?? '—'}</td>
                      <td>
                        <div style={{ fontSize: 11.5 }}>{d.designation}</div>
                        {d.intitule && <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{d.intitule}</div>}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{d.prestataire ?? '—'}</td>
                      <td className={`tnum fw7 ${d.type === 'ENTREE BANQUE' ? 'tc' : 'rc'}`}>
                        {fmt(d.montant)}
                      </td>
                      <td className="tnum" style={{ color: 'var(--tx3)', fontSize: 11 }}>
                        {d.fraisTransf > 0 ? fmt(d.fraisTransf) : '—'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{d.reference ?? '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="ibt" title="Modifier" onClick={() => openEdit(d)}>
                          <Pencil size={13} strokeWidth={2} />
                        </button>
                        <button className="ibt del" title="Supprimer"
                          onClick={() => { if (confirm('Supprimer cette opération ?')) deleteMutation.mutate(d.id); }}>
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

      <Modal
        open={modalOpen}
        title={editId ? "Modifier l'opération" : 'Nouvelle opération bancaire'}
        onClose={() => setModalOpen(false)}
        onSave={save}
        saving={isSaving}
        saveLabel={isSaving ? 'Enregistrement…' : 'Enregistrer'}
        width={620}
      >
        <div className="fg">
          <Field as="select" label="Type *" value={form.values.type} error={form.errors.type}
            onChange={e => form.set('type', e.target.value as DepenseInput['type'])}>
            <option value="SORTIE BANQUE">Sortie banque</option>
            <option value="ENTREE BANQUE">Entrée banque</option>
          </Field>
          <Field as="select" label="Nature" value={form.values.nature}
            onChange={e => form.set('nature', e.target.value as DepenseInput['nature'])}>
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
            onChange={e => form.set('des', e.target.value)} placeholder="Ex : Virement salaires mars" />
          <Field label="Intitulé" value={form.values.int}
            onChange={e => form.set('int', e.target.value)} placeholder="Détail complémentaire" />
          <Field as="select" label="Catégorie" value={form.values.cat}
            onChange={e => form.set('cat', e.target.value)}>
            <option value="">—</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Field>
          <Field label="Prestataire" value={form.values.prest}
            onChange={e => form.set('prest', e.target.value)} />
          <Field label="Montant (FCFA) *" type="number" value={form.values.mnt} error={form.errors.mnt}
            onChange={e => form.set('mnt', +e.target.value)} />
          <Field label="Frais de transfert" type="number" value={form.values.ft}
            onChange={e => form.set('ft', +e.target.value)} />
          <Field label="Pénalité" type="number" value={form.values.pen}
            onChange={e => form.set('pen', +e.target.value)} />
          <Field label="Référence" value={form.values.ref}
            onChange={e => form.set('ref', e.target.value)} />
          {saveError && (
            <div className="alert r" style={{ marginTop: 4 }}>{saveError}</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
