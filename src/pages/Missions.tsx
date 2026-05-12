import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { fmt, ST_LABEL, ST_CLS } from '../utils/format';
import { missionSchema, type MissionInput } from '../schemas';
import { useForm } from '../hooks/useForm';
import { useMissions, useCreateMission, useUpdateMission, useDeleteMission } from '../hooks/queries/useMissions';
import Modal from '../components/ui/Modal';
import Field from '../components/ui/Field';
import ClientPicker from '../components/ui/ClientPicker';
import { QueryRows } from '../components/ui/QueryState';

const STAGES = ['prospect', 'tdr', 'propale', 'contrat', 'en_cours', 'termine', 'perdu'] as const;
const APPORTEURS = ['HBS', 'TDA', 'TEZ', 'AFO', 'AUTRES'];

const STAGE_COLOR: Record<string, string> = {
  prospect: 'var(--P)', tdr: 'var(--B)', propale: 'var(--A)',
  contrat: 'var(--P)', en_cours: 'var(--G)', termine: 'var(--tx3)', perdu: 'var(--R)',
};

const initial: MissionInput = {
  nom: '', client: '', apporteur: '', statut: 'prospect',
  montant: 0, avance: 0, debut: '', fin: '',
  tva: 'exo', nature: 'prevu', desc: '',
};

export default function Missions() {
  const { data: missions = [], isLoading, error } = useMissions();
  const createMutation = useCreateMission();
  const updateMutation = useUpdateMission();
  const deleteMutation = useDeleteMission();

  const [filSt, setFilSt] = useState('');
  const [filAp, setFilAp] = useState('');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const form = useForm(missionSchema, initial);

  // KPIs
  const active     = missions.filter(m => !['TERMINE', 'PERDU'].includes(m.statut.toUpperCase()));
  const contracted = missions.filter(m => ['CONTRAT', 'EN_COURS'].includes(m.statut.toUpperCase()));
  const caPipeline  = active.reduce((s, m) => s + m.montant, 0);
  const caContracte = contracted.reduce((s, m) => s + m.montant, 0);
  const caEncaisse  = missions.reduce((s, m) => s + m.avance, 0);

  const list = missions.filter(m =>
    (!filSt || m.statut.toLowerCase() === filSt) &&
    (!filAp || m.apporteur === filAp)
  );

  function openNew() {
    setEditId(null);
    form.reset();
    setModal(true);
  }

  function openEdit(m: (typeof missions)[0]) {
    setEditId(m.id);
    form.reset({
      nom: m.nom,
      client: m.client,
      apporteur: m.apporteur ?? '',
      statut: m.statut.toLowerCase() as MissionInput['statut'],
      montant: m.montant,
      avance: m.avance,
      debut: m.debut ? m.debut.slice(0, 10) : '',
      fin: m.fin ? m.fin.slice(0, 10) : '',
      tva: (m.tva ?? 'exo') as MissionInput['tva'],
      nature: (m.nature ?? 'prevu') as MissionInput['nature'],
      desc: m.desc ?? '',
    });
    setModal(true);
  }

  async function save() {
    if (!form.validate()) return;
    if (editId) {
      await updateMutation.mutateAsync({ id: editId, data: form.values });
    } else {
      await createMutation.mutateAsync(form.values);
    }
    setModal(false);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="pg">
      <div className="ph">
        <div className="ph-l">
          <h1>Missions & Pipeline</h1>
          <p>Cycle complet Prospect → TDR → Propale → Contrat → Facturation → Clôture</p>
        </div>
        <div className="ph-r">
          <button className="btn prim" onClick={openNew}><Plus size={15} strokeWidth={2.5} />Nouvelle mission</button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kr">
        <div className="kpi b">
          <div className="kpi-l">Missions actives</div>
          <div className="kpi-v">{active.length}</div>
          <div className="kpi-s">sur {missions.length} au total</div>
        </div>
        <div className="kpi a">
          <div className="kpi-l">CA Pipeline</div>
          <div className="kpi-v">{fmt(caPipeline)}</div>
          <div className="kpi-s">FCFA — hors terminées & perdues</div>
        </div>
        <div className="kpi g">
          <div className="kpi-l">CA Contracté</div>
          <div className="kpi-v">{fmt(caContracte)}</div>
          <div className="kpi-s">FCFA — Contrat + En cours</div>
        </div>
        <div className="kpi t">
          <div className="kpi-l">Encaissé</div>
          <div className="kpi-v">{fmt(caEncaisse)}</div>
          <div className="kpi-s">FCFA — avances reçues</div>
        </div>
      </div>

      {/* ── Kanban ── */}
      <div className="pl-board">
        {STAGES.map(s => {
          const items = missions.filter(m => m.statut.toLowerCase() === s);
          const col   = STAGE_COLOR[s];
          return (
            <div key={s} className="pl-col" style={{ borderTop: `3px solid ${col}` }}>
              <div className="pl-col-h" style={{ color: col }}>
                {ST_LABEL[s]}
                <span style={{
                  background: 'rgba(0,0,0,.07)', padding: '1px 6px',
                  borderRadius: 9, marginLeft: 4, color: 'var(--tx2)',
                }}>
                  {items.length}
                </span>
              </div>

              {items.length === 0
                ? <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--bor2)', fontSize: 11 }}>—</div>
                : items.map(m => {
                  const pct = m.montant > 0 ? Math.min(100, (m.avance / m.montant) * 100) : 0;
                  return (
                    <div key={m.id} className="pl-item" style={{ borderLeftColor: col }} onClick={() => openEdit(m)}>
                      <div className="pl-n">{m.nom}</div>
                      <div className="pl-a" style={{ color: col }}>{fmt(m.montant)} FCFA</div>
                      <div className="pl-c">{m.client}</div>
                      {m.apporteur && <div className="pl-app">▸ {m.apporteur}</div>}
                      {m.montant > 0 && (
                        <div className="prog" style={{ marginTop: 5 }}>
                          <div className="prog-b" style={{ width: `${pct}%`, background: col }} />
                        </div>
                      )}
                    </div>
                  );
                })
              }
            </div>
          );
        })}
      </div>

      {/* ── Table ── */}
      <div className="card">
        <div className="ch fb">
          <h3>Toutes les missions</h3>
          <div className="fr2">
            <select className="sel" value={filSt} onChange={e => setFilSt(e.target.value)} style={{ width: 140 }}>
              <option value="">Tous statuts</option>
              {STAGES.map(s => <option key={s} value={s}>{ST_LABEL[s]}</option>)}
            </select>
            <select className="sel" value={filAp} onChange={e => setFilAp(e.target.value)} style={{ width: 130 }}>
              <option value="">Tous apporteurs</option>
              {APPORTEURS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Mission</th>
                <th>Client</th>
                <th>Apporteur</th>
                <th className="tr">Montant HT</th>
                <th className="tr">Avance</th>
                <th className="tr">Reste</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Étape</th>
                <th>TVA</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <QueryRows isLoading={isLoading} error={error} colSpan={11} />
              {!isLoading && !error && (
                list.length === 0
                  ? <tr><td colSpan={11} className="empty">Aucune mission</td></tr>
                  : list.map(m => {
                    const statL = m.statut.toLowerCase();
                    const reste = m.montant - m.avance;
                    return (
                      <tr key={m.id}>
                        <td className="fw7">{m.nom}</td>
                        <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{m.client}</td>
                        <td>
                          {m.apporteur
                            ? <span className="bdg bb">{m.apporteur}</span>
                            : <span className="bdg bn">Interne</span>}
                        </td>
                        <td className="tnum">{fmt(m.montant)}</td>
                        <td className="tnum tc">{fmt(m.avance)}</td>
                        <td className={`tnum ${reste > 0 ? 'ac' : 'tc'}`}>{fmt(reste)}</td>
                        <td style={{ fontSize: 11 }}>{m.debut ? m.debut.slice(0, 10) : '—'}</td>
                        <td style={{ fontSize: 11 }}>{m.fin ? m.fin.slice(0, 10) : '—'}</td>
                        <td><span className={`bdg ${ST_CLS[statL] ?? 'bn'}`}>{ST_LABEL[statL] ?? m.statut}</span></td>
                        <td><span className="bdg bn">{m.tva === '18' ? '18%' : 'Exo'}</span></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="ibt" title="Modifier" onClick={() => openEdit(m)}><Pencil size={13} strokeWidth={2} /></button>
                          <button className="ibt del" title="Supprimer"
                            onClick={() => { if (confirm(`Supprimer « ${m.nom} » ?`)) deleteMutation.mutate(m.id); }}
                          ><Trash2 size={13} strokeWidth={2} /></button>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Création / Édition ── */}
      <Modal
        open={modal}
        title={editId ? 'Modifier la mission' : 'Nouvelle mission'}
        onClose={() => setModal(false)}
        onSave={save}
        saveLabel={isSaving ? 'Enregistrement…' : 'Enregistrer'}
        width={700}
      >
        <div className="fg">
          <Field full label="Nom de la mission *" value={form.values.nom} error={form.errors.nom}
            onChange={e => form.set('nom', e.target.value)} placeholder="Ex : Transformation Poste 5.0" />
          <div className="fr full">
            <label className="lbl">Client *</label>
            <ClientPicker
              value={form.values.client}
              onChange={val => form.set('client', val)}
              error={form.errors.client}
            />
          </div>
          <Field as="select" label="Apporteur" value={form.values.apporteur}
            onChange={e => form.set('apporteur', e.target.value)}>
            <option value="">— Interne —</option>
            {APPORTEURS.map(a => <option key={a}>{a}</option>)}
          </Field>
          <Field as="select" label="Étape pipeline" value={form.values.statut} error={form.errors.statut}
            onChange={e => form.set('statut', e.target.value as MissionInput['statut'])}>
            {STAGES.map(s => <option key={s} value={s}>{ST_LABEL[s]}</option>)}
          </Field>
          <Field label="Montant HT (FCFA)" type="number" value={form.values.montant} error={form.errors.montant}
            onChange={e => form.set('montant', +e.target.value)} />
          <Field label="Avance encaissée (FCFA)" type="number" value={form.values.avance} error={form.errors.avance}
            onChange={e => form.set('avance', +e.target.value)} />
          <Field label="Date début" type="date" value={form.values.debut}
            onChange={e => form.set('debut', e.target.value)} />
          <Field label="Date fin (prévue)" type="date" value={form.values.fin}
            onChange={e => form.set('fin', e.target.value)} />
          <Field as="select" label="TVA" value={form.values.tva}
            onChange={e => form.set('tva', e.target.value as MissionInput['tva'])}>
            <option value="exo">Exonérée</option>
            <option value="18">18%</option>
          </Field>
          <Field as="select" label="Nature" value={form.values.nature}
            onChange={e => form.set('nature', e.target.value as MissionInput['nature'])}>
            <option value="prevu">Prévu</option>
            <option value="imprevu">Imprévu</option>
          </Field>
          <Field as="textarea" full label="Description" value={form.values.desc}
            onChange={e => form.set('desc', e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
