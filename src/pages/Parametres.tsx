import { useState, useEffect } from 'react';
import { Save, Plus, ShieldCheck, Eye, Briefcase, Lock, Unlock, Trash2, KeyRound } from 'lucide-react';
import { fmt } from '../utils/format';
import { useParams, useUpdateParams } from '../hooks/queries/useParams';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../hooks/queries/useUsers';
import { useAuth } from '../context/AuthContext';
import { changePasswordRequest } from '../services/auth.service';
import { QueryCard, QueryRows } from '../components/ui/QueryState';
import Modal from '../components/ui/Modal';
import Field from '../components/ui/Field';

// ─────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────

interface FormVals {
  banque: number; coffre: number;
  masse_sal: number; charges_pat: number; primes_mens: number;
  arr_sal: number; arr_sal_r: number; arr_sal_m: number;
  arr_prim: number; arr_prim_m: number;
}

const DEFAULTS: FormVals = {
  banque: 0, coffre: 0, masse_sal: 0, charges_pat: 0, primes_mens: 0,
  arr_sal: 0, arr_sal_r: 0, arr_sal_m: 0, arr_prim: 0, arr_prim_m: 0,
};

const PARAM_REF = [
  { lib: 'Masse salariale brute mensuelle',  key: 'masse_sal'   as const, per: 'Mensuelle', obs: 'Budget paie complet' },
  { lib: 'Charges patronales',               key: 'charges_pat' as const, per: 'Mensuelle', obs: '% du brut' },
  { lib: 'Primes mensuelles régulières',     key: 'primes_mens' as const, per: 'Mensuelle', obs: '' },
  { lib: 'Arriéré salaires (total dû)',      key: 'arr_sal'     as const, per: 'Cumul',     obs: 'À apurer progressivement' },
  { lib: 'Arriéré salaires remboursé',       key: 'arr_sal_r'   as const, per: 'Cumul',     obs: '' },
  { lib: 'Mensualité remboursement arriéré', key: 'arr_sal_m'   as const, per: 'Mensuelle', obs: '' },
  { lib: 'Arriéré primes (total dû)',        key: 'arr_prim'    as const, per: 'Cumul',     obs: '' },
  { lib: 'Mensualité remboursement primes',  key: 'arr_prim_m'  as const, per: 'Mensuelle', obs: '' },
];

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin', COO: 'COO', VIEWER: 'Lecteur' };
const ROLE_CLS:   Record<string, string> = { ADMIN: 'br',    COO: 'bb',  VIEWER: 'bn' };

// ─────────────────────────────────────────────────────
//  Onglet Général
// ─────────────────────────────────────────────────────

function TabGeneral() {
  const { data: params, isLoading, error } = useParams();
  const updateMutation = useUpdateParams();

  const [form,    setForm]    = useState<FormVals>(DEFAULTS);
  const [synced,  setSynced]  = useState(false);
  const [saveOk,  setSaveOk]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    if (!synced && params) {
      setForm({
        banque: params.banque, coffre: params.coffre,
        masse_sal: params.masseSal, charges_pat: params.chargesPat, primes_mens: params.primesMens,
        arr_sal: params.arrSal, arr_sal_r: params.arrSalR, arr_sal_m: params.arrSalM,
        arr_prim: params.arrPrim, arr_prim_m: params.arrPrimM,
      });
      setSynced(true);
    }
  }, [synced, params]);

  const set = (key: keyof FormVals, val: number) => {
    setForm(f => ({ ...f, [key]: val }));
    setSaveOk(false); setSaveErr(null);
  };

  const isDirty = params && synced && (
    form.banque !== params.banque || form.coffre !== params.coffre ||
    form.masse_sal !== params.masseSal || form.charges_pat !== params.chargesPat ||
    form.primes_mens !== params.primesMens || form.arr_sal !== params.arrSal ||
    form.arr_sal_r !== params.arrSalR || form.arr_sal_m !== params.arrSalM ||
    form.arr_prim !== params.arrPrim || form.arr_prim_m !== params.arrPrimM
  );

  async function save() {
    setSaveErr(null);
    try {
      await updateMutation.mutateAsync(form);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e) { setSaveErr(e instanceof Error ? e.message : 'Erreur'); }
  }

  const arrSolde     = form.arr_sal - form.arr_sal_r;
  const moisRestants = form.arr_sal_m > 0 ? Math.ceil(arrSolde / form.arr_sal_m) : 0;
  const pctApure     = form.arr_sal > 0 ? Math.round(form.arr_sal_r / form.arr_sal * 100) : 0;

  if (isLoading) return <QueryCard isLoading error={null} />;
  if (error)     return <QueryCard isLoading={false} error={error} />;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {isDirty && <span style={{ fontSize: 11, color: 'var(--A)', fontFamily: 'var(--fm)' }}>Modifications non sauvegardées</span>}
        {saveOk  && <span style={{ fontSize: 11, color: 'var(--G)', fontFamily: 'var(--fm)' }}>✓ Enregistré</span>}
        <button className="btn prim" onClick={save}
          disabled={!isDirty || updateMutation.isPending}
          style={{ opacity: (!isDirty || updateMutation.isPending) ? .5 : 1 }}>
          <Save size={14} strokeWidth={2} />
          {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
      {saveErr && <div className="alert r" style={{ marginBottom: 14 }}>{saveErr}</div>}

      <div className="g2" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="ch"><h3>Trésorerie & Ressources humaines</h3></div>
          <div className="cb">
            <div className="fg" style={{ gridTemplateColumns: '1fr' }}>
              {[
                { lbl: 'Solde compte bancaire (FCFA)',      key: 'banque'      as const },
                { lbl: 'Solde coffre-fort (FCFA)',          key: 'coffre'      as const },
                { lbl: 'Masse salariale brute mensuelle',   key: 'masse_sal'   as const },
                { lbl: 'Charges patronales (FCFA)',         key: 'charges_pat' as const },
                { lbl: 'Primes mensuelles régulières',      key: 'primes_mens' as const },
              ].map(({ lbl, key }) => (
                <div className="fr" key={key}>
                  <label className="lbl">{lbl}</label>
                  <input className="inp" type="number" value={form[key]} onChange={e => set(key, +e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="ch"><h3>Arriérés salaires & primes</h3></div>
          <div className="cb">
            <div className="fg" style={{ gridTemplateColumns: '1fr' }}>
              {[
                { lbl: 'Arriéré salaires — cumul total dû', key: 'arr_sal'   as const },
                { lbl: 'Remboursé à ce jour',               key: 'arr_sal_r' as const },
                { lbl: 'Mensualité de remboursement',        key: 'arr_sal_m' as const },
                { lbl: 'Arriéré primes — cumul total dû',   key: 'arr_prim'  as const },
                { lbl: 'Mensualité remboursement primes',   key: 'arr_prim_m' as const },
              ].map(({ lbl, key }) => (
                <div className="fr" key={key}>
                  <label className="lbl">{lbl}</label>
                  <input className="inp" type="number" value={form[key]} onChange={e => set(key, +e.target.value)} />
                  {key === 'arr_sal_r' && form.arr_sal_r > form.arr_sal && (
                    <span style={{ fontSize: 10, color: 'var(--R)', fontFamily: 'var(--fm)' }}>Dépasse le total dû</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch"><h3>Référentiel charges fixes</h3></div>
        <div className="tw">
          <table>
            <thead><tr><th>Paramètre</th><th className="tr">Montant (FCFA)</th><th>Périodicité</th><th>Remarques</th></tr></thead>
            <tbody>
              {PARAM_REF.map(p => (
                <tr key={p.key}>
                  <td style={{ fontSize: 12 }}>{p.lib}</td>
                  <td className="tnum fw7">{fmt(form[p.key])}</td>
                  <td><span className="bdg bn">{p.per}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{p.obs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="ch"><h3>Suivi arriérés</h3></div>
        <div className="tw">
          <table>
            <thead><tr><th>Catégorie</th><th className="tr">Total dû</th><th className="tr">Remboursé</th><th className="tr">Solde</th><th className="tr">Mensualité</th><th className="tr">Mois rest.</th><th>% Apuré</th></tr></thead>
            <tbody>
              <tr>
                <td className="fw7">Arriéré salaires</td>
                <td className="tnum">{fmt(form.arr_sal)}</td>
                <td className="tnum tc">{fmt(form.arr_sal_r)}</td>
                <td className={`tnum fw7 ${arrSolde > 0 ? 'rc' : 'tc'}`}>{fmt(arrSolde)}</td>
                <td className="tnum">{fmt(form.arr_sal_m)}</td>
                <td className="tnum">{moisRestants > 0 ? moisRestants : '—'}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="fw7" style={{ fontSize: 11, fontFamily: 'var(--fm)', minWidth: 32 }}>{pctApure}%</span>
                    <div className="prog" style={{ flex: 1, minWidth: 80 }}>
                      <div className="prog-b" style={{ width: `${Math.min(pctApure, 100)}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
              {form.arr_prim > 0 && (
                <tr>
                  <td className="fw7">Arriéré primes</td>
                  <td className="tnum">{fmt(form.arr_prim)}</td>
                  <td className="tnum" style={{ color: 'var(--tx3)' }}>—</td>
                  <td className="tnum fw7 rc">{fmt(form.arr_prim)}</td>
                  <td className="tnum">{fmt(form.arr_prim_m)}</td>
                  <td className="tnum">{form.arr_prim_m > 0 ? Math.ceil(form.arr_prim / form.arr_prim_m) : '—'}</td>
                  <td><span style={{ fontSize: 11, fontFamily: 'var(--fm)', fontWeight: 700 }}>0%</span></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────
//  Onglet Mon profil
// ─────────────────────────────────────────────────────

function TabProfil() {
  const { user } = useAuth();
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confPwd, setConfPwd] = useState('');
  const [saving, setSaving]   = useState(false);
  const [msg,    setMsg]      = useState<{ ok: boolean; text: string } | null>(null);

  async function changePassword() {
    setMsg(null);
    if (newPwd.length < 6)       { setMsg({ ok: false, text: 'Le nouveau mot de passe doit faire au moins 6 caractères' }); return; }
    if (newPwd !== confPwd)      { setMsg({ ok: false, text: 'Les mots de passe ne correspondent pas' }); return; }
    setSaving(true);
    try {
      await changePasswordRequest(curPwd, newPwd);
      setMsg({ ok: true, text: 'Mot de passe mis à jour avec succès' });
      setCurPwd(''); setNewPwd(''); setConfPwd('');
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Erreur' });
    } finally { setSaving(false); }
  }

  return (
    <div className="g2">
      {/* Infos du compte */}
      <div className="card">
        <div className="ch"><h3>Informations du compte</h3></div>
        <div className="cb">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(0,196,98,.12)', color: 'var(--G)',
                fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {(user?.name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{user?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--tx3)', fontFamily: 'var(--fm)', marginTop: 2 }}>{user?.email}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { lbl: 'Rôle', val: ROLE_LABEL[user?.role ?? ''] ?? user?.role, cls: ROLE_CLS[user?.role ?? ''] ?? 'bn' },
                { lbl: 'Statut', val: 'Actif', cls: 'bg' },
              ].map(({ lbl, val, cls }) => (
                <div key={lbl} style={{ background: 'var(--sur2)', border: '1px solid var(--bor)', borderRadius: 'var(--r)', padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'var(--fm)', marginBottom: 6 }}>{lbl}</div>
                  <span className={`bdg ${cls}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Changer mot de passe */}
      <div className="card">
        <div className="ch" style={{ gap: 6 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><KeyRound size={14} strokeWidth={2} />Changer le mot de passe</h3>
        </div>
        <div className="cb">
          <div className="fg" style={{ gridTemplateColumns: '1fr' }}>
            <div className="fr">
              <label className="lbl">Mot de passe actuel</label>
              <input className="inp" type="password" value={curPwd} onChange={e => setCurPwd(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="fr">
              <label className="lbl">Nouveau mot de passe</label>
              <input className="inp" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="fr">
              <label className="lbl">Confirmer le nouveau mot de passe</label>
              <input className="inp" type="password" value={confPwd} onChange={e => setConfPwd(e.target.value)} autoComplete="new-password" />
            </div>
            {msg && <div className={`alert ${msg.ok ? 'g' : 'r'}`} style={{ marginBottom: 0 }}>{msg.text}</div>}
            <button className="btn prim" onClick={changePassword} disabled={saving || !curPwd || !newPwd || !confPwd}>
              <Save size={14} strokeWidth={2} />
              {saving ? 'Mise à jour…' : 'Mettre à jour'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
//  Onglet Utilisateurs (ADMIN only)
// ─────────────────────────────────────────────────────

function TabUtilisateurs() {
  const { user: me } = useAuth();
  const { data: users = [], isLoading, error } = useUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [modal, setModal]   = useState(false);
  const [name,  setName]    = useState('');
  const [email, setEmail]   = useState('');
  const [pwd,   setPwd]     = useState('');
  const [role,  setRole]    = useState<'ADMIN' | 'COO' | 'VIEWER'>('VIEWER');
  const [err,   setErr]     = useState<string | null>(null);

  function openModal() { setName(''); setEmail(''); setPwd(''); setRole('VIEWER'); setErr(null); setModal(true); }

  async function create() {
    setErr(null);
    if (!name || !email || !pwd) { setErr('Tous les champs sont requis'); return; }
    if (pwd.length < 6) { setErr('Mot de passe : 6 caractères minimum'); return; }
    try {
      await createMutation.mutateAsync({ name, email, password: pwd, role });
      setModal(false);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); }
  }

  async function toggleActive(u: typeof users[0]) {
    await updateMutation.mutateAsync({ id: u.id, data: { active: !u.active } });
  }

  async function changeRole(u: typeof users[0], newRole: string) {
    await updateMutation.mutateAsync({ id: u.id, data: { role: newRole } });
  }

  if (error) return <QueryCard isLoading={false} error={error} />;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn prim" onClick={openModal}>
          <Plus size={15} strokeWidth={2.5} />Nouvel utilisateur
        </button>
      </div>

      <div className="card">
        <div className="ch fb">
          <h3>Utilisateurs ({users.length})</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className="bdg br">Admin</span>
            <span className="bdg bb">COO</span>
            <span className="bdg bn">Lecteur</span>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Créé le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <QueryRows isLoading={isLoading} error={null} colSpan={6} />
              {!isLoading && users.map(u => {
                const isSelf = u.id === (me as any)?.id;
                return (
                  <tr key={u.id} style={!u.active ? { opacity: .5 } : undefined}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: 'rgba(0,196,98,.1)', color: 'var(--G)',
                          fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 10,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="fw7" style={{ fontSize: 12 }}>{u.name}</span>
                        {isSelf && <span className="bdg bg" style={{ fontSize: 9 }}>vous</span>}
                      </div>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>{u.email}</td>
                    <td>
                      {isSelf
                        ? <span className={`bdg ${ROLE_CLS[u.role] ?? 'bn'}`}>{ROLE_LABEL[u.role]}</span>
                        : (
                          <select className="sel" value={u.role}
                            style={{ width: 110, padding: '3px 7px', fontSize: 11 }}
                            onChange={e => changeRole(u, e.target.value)}
                            disabled={updateMutation.isPending}>
                            <option value="ADMIN">Admin</option>
                            <option value="COO">COO</option>
                            <option value="VIEWER">Lecteur</option>
                          </select>
                        )
                      }
                    </td>
                    <td>
                      <span className={`bdg ${u.active ? 'bg' : 'br'}`}>
                        {u.active ? 'Actif' : 'Bloqué'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{u.createdAt.slice(0, 10)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!isSelf && (
                          <>
                            <button
                              className={`ibt`}
                              title={u.active ? 'Bloquer' : 'Débloquer'}
                              onClick={() => toggleActive(u)}
                              disabled={updateMutation.isPending}
                              style={{ color: u.active ? 'var(--A)' : 'var(--G)' }}
                            >
                              {u.active ? <Lock size={13} strokeWidth={2} /> : <Unlock size={13} strokeWidth={2} />}
                            </button>
                            <button
                              className="ibt del"
                              title="Supprimer"
                              onClick={() => { if (confirm(`Supprimer ${u.name} ?`)) deleteMutation.mutate(u.id); }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 size={13} strokeWidth={2} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Légende rôles */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="ch"><h3>Description des rôles</h3></div>
        <div className="cb">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { role: 'ADMIN', Icon: ShieldCheck, color: 'var(--R)', desc: 'Accès complet — gestion des utilisateurs, paramètres, toutes les pages. Peut bloquer ou supprimer des comptes.' },
              { role: 'COO',   Icon: Briefcase,   color: 'var(--B)', desc: 'Accès complet à toutes les pages métier. Ne peut pas gérer les utilisateurs ni les paramètres système.' },
              { role: 'VIEWER',Icon: Eye,          color: 'var(--tx2)', desc: 'Lecture seule — peut consulter toutes les pages mais ne peut pas créer, modifier ou supprimer de données.' },
            ].map(({ role, Icon, color, desc }) => (
              <div key={role} style={{ background: 'var(--sur2)', border: '1px solid var(--bor)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Icon size={16} strokeWidth={1.8} color={color} />
                  <span className={`bdg ${ROLE_CLS[role]}`}>{ROLE_LABEL[role]}</span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.5, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal création */}
      <Modal
        open={modal}
        title="Nouvel utilisateur"
        onClose={() => setModal(false)}
        onSave={create}
        saving={createMutation.isPending}
        saveLabel={createMutation.isPending ? 'Création…' : 'Créer le compte'}
        width={480}
      >
        <div className="fg" style={{ gridTemplateColumns: '1fr' }}>
          <Field label="Nom complet *" value={name} onChange={e => setName(e.target.value)} placeholder="Prénom Nom" />
          <Field label="Email *" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@marabu.ci" />
          <Field label="Mot de passe * (min. 6 caractères)" type="password" value={pwd} onChange={e => setPwd(e.target.value)} />
          <Field as="select" label="Rôle" value={role} onChange={e => setRole(e.target.value as typeof role)}>
            <option value="VIEWER">Lecteur — lecture seule</option>
            <option value="COO">COO — accès complet</option>
            <option value="ADMIN">Admin — accès total + gestion users</option>
          </Field>
          {err && <div className="alert r" style={{ marginBottom: 0 }}>{err}</div>}
        </div>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────
//  Page principale
// ─────────────────────────────────────────────────────

type Tab = 'general' | 'profil' | 'utilisateurs';

export default function Parametres() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('general');
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="pg">
      <div className="ph">
        <div className="ph-l">
          <h1>Paramètres</h1>
          <p>Configuration générale, profil et gestion des accès</p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'general'       ? ' on' : ''}`} onClick={() => setTab('general')}>Général</button>
        <button className={`tab${tab === 'profil'        ? ' on' : ''}`} onClick={() => setTab('profil')}>Mon profil</button>
        {isAdmin && (
          <button className={`tab${tab === 'utilisateurs' ? ' on' : ''}`} onClick={() => setTab('utilisateurs')}>
            <ShieldCheck size={13} strokeWidth={2} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
            Utilisateurs
          </button>
        )}
      </div>

      {tab === 'general'       && <TabGeneral />}
      {tab === 'profil'        && <TabProfil />}
      {tab === 'utilisateurs'  && isAdmin && <TabUtilisateurs />}
    </div>
  );
}
