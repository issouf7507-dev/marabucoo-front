import { useState, useCallback } from 'react';
import {
  FileCheck2, Plus, Trash2, Send, CheckCircle2, AlertTriangle,
  Settings2, Copy, ExternalLink, RotateCcw, ChevronDown, ChevronUp, ArrowRight,
} from 'lucide-react';
import Field from '../components/ui/Field';
import { useFactures } from '../hooks/queries/useFactures';
import { useClients } from '../hooks/queries/useClients';
import { QueryCard } from '../components/ui/QueryState';
import { fmt } from '../utils/format';
import type { ApiFacture } from '../services/factures.service';
import {
  fneService,
  getFneToken, setFneToken,
  getFneUrl, setFneUrl,
  getFneEnv, setFneEnv,
  FNE_TEST_URL,
  type FneEnv,
  type FneInvoiceRequest,
  type FneInvoiceResponse,
  type FneRefundResponse,
} from '../services/fne.service';
import type { ApiClient } from '../services/clients.service';

// ── FNE certification cache (localStorage) ────────────────────────────────────

const FNE_CERTS_KEY = 'fne_certs';

interface FneCert { reference: string; token: string; date: string }
type FneCerts = Record<number, FneCert>; // factureId → cert

function getCerts(): FneCerts {
  try { return JSON.parse(localStorage.getItem(FNE_CERTS_KEY) ?? '{}'); } catch { return {}; }
}
function saveCert(factureId: number, cert: FneCert) {
  const all = getCerts();
  all[factureId] = cert;
  localStorage.setItem(FNE_CERTS_KEY, JSON.stringify(all));
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { v: 'cash', l: 'Espèces' },
  { v: 'card', l: 'Carte bancaire' },
  { v: 'check', l: 'Chèque' },
  { v: 'mobile-money', l: 'Mobile money' },
  { v: 'transfer', l: 'Virement bancaire' },
  { v: 'deferred', l: 'Terme (différé)' },
];

const TEMPLATES = [
  { v: 'B2C', l: 'B2C – Particulier' },
  { v: 'B2B', l: 'B2B – Professionnel (NCC)' },
  { v: 'B2G', l: 'B2G – Institution gouvernementale' },
  { v: 'B2F', l: 'B2F – Étranger (devise)' },
];

const TVA_TYPES = [
  { v: 'TVA', l: 'TVA normal 18% (TVA)' },
  { v: 'TVAB', l: 'TVA réduit 9% (TVAB)' },
  { v: 'TVAC', l: 'TVA exo. conv. 0% (TVAC)' },
  { v: 'TVAD', l: 'TVA exo. légal 0% (TVAD)' },
];

const CURRENCIES = [
  { v: '', l: 'FCFA (XOF)' },
  { v: 'USD', l: 'Dollar US (USD)' },
  { v: 'EUR', l: 'Euro (EUR)' },
  { v: 'GBP', l: 'Livre sterling (GBP)' },
  { v: 'JPY', l: 'Yen japonais (JPY)' },
  { v: 'CAD', l: 'Dollar canadien (CAD)' },
  { v: 'AUD', l: 'Dollar australien (AUD)' },
  { v: 'CNH', l: 'Yuan chinois (CNH)' },
  { v: 'CHF', l: 'Franc suisse (CHF)' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ItemLine {
  id: number;
  reference: string;
  description: string;
  quantity: number;
  amount: number;
  discount: number;
  measurementUnit: string;
  tva: string;
  customTaxName: string;
  customTaxAmount: number;
}

interface AvoirItemLine { id: string; quantity: number; description: string }

function emptyItem(id: number): ItemLine {
  return { id, reference: '', description: '', quantity: 1, amount: 0, discount: 0, measurementUnit: '', tva: 'TVA', customTaxName: '', customTaxAmount: 0 };
}

type Tab = 'existantes' | 'certifier' | 'avoir' | 'config';

// ── Helpers ───────────────────────────────────────────────────────────────────

function badge(env: FneEnv) {
  return env === 'test'
    ? <span className="bdg ba">TEST</span>
    : <span className="bdg bg">PROD</span>;
}

function copied(text: string) {
  navigator.clipboard.writeText(text).catch(() => { });
}

function calcTva(amount: number, qty: number, disc: number, tva: string): number {
  const ht = amount * qty * (1 - disc / 100);
  const rate = tva === 'TVA' ? 0.18 : tva === 'TVAB' ? 0.09 : 0;
  return Math.round(ht * rate);
}

function calcHt(amount: number, qty: number, disc: number): number {
  return Math.round(amount * qty * (1 - disc / 100));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResultPanel({
  result, onReset,
}: { result: FneInvoiceResponse | FneRefundResponse; onReset: () => void }) {
  const [cp, setCp] = useState(false);
  const ref = result.reference;
  const tok = result.token;

  function copyRef() {
    copied(ref);
    setCp(true);
    setTimeout(() => setCp(false), 1500);
  }

  return (
    <div style={{ border: '1px solid var(--Gs)', borderRadius: 'var(--rl)', padding: '20px 22px', background: 'rgba(0,196,98,.04)', marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <CheckCircle2 size={18} color="var(--G)" strokeWidth={2} />
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--G)' }}>Facture certifiée avec succès</span>
        {result.warning && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--A)' }}>
            <AlertTriangle size={12} strokeWidth={2} />Stock stickers faible ({result.balance_sticker} restants)
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ background: 'var(--sur2)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
          <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)', marginBottom: 3 }}>NCC CONTRIBUABLE</div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 600, color: 'var(--tx)' }}>{result.ncc}</div>
        </div>
        <div style={{ background: 'var(--sur2)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
          <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)', marginBottom: 3 }}>SOLDE STICKERS</div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 600, color: result.balance_sticker < 20 ? 'var(--A)' : 'var(--tx)' }}>
            {result.balance_sticker}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--sur2)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>NUMÉRO DE FACTURE</span>
          <button
            onClick={copyRef}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: cp ? 'var(--G)' : 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 4px' }}
          >
            <Copy size={11} strokeWidth={2} />{cp ? 'Copié !' : 'Copier'}
          </button>
        </div>
        <div style={{ fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 700, color: 'var(--tx)', letterSpacing: '.04em' }}>{ref}</div>
      </div>

      <div style={{ background: 'var(--sur2)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)', marginBottom: 4 }}>LIEN DE VÉRIFICATION (QR CODE)</div>
        <a href={tok} target="_blank" rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--B)', wordBreak: 'break-all', fontFamily: 'var(--fm)' }}>
          <ExternalLink size={11} strokeWidth={2} />{tok}
        </a>
      </div>

      {'invoice' in result && result.invoice && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          <div style={{ background: 'var(--sur2)', borderRadius: 'var(--r)', padding: '8px 10px' }}>
            <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>MONTANT TTC</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--tx)', marginTop: 2 }}>
              {result.invoice.amount.toLocaleString('fr-FR')} FCFA
            </div>
          </div>
          <div style={{ background: 'var(--sur2)', borderRadius: 'var(--r)', padding: '8px 10px' }}>
            <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>TVA</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--tx)', marginTop: 2 }}>
              {result.invoice.vatAmount.toLocaleString('fr-FR')} FCFA
            </div>
          </div>
          <div style={{ background: 'var(--sur2)', borderRadius: 'var(--r)', padding: '8px 10px' }}>
            <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>STATUT</div>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--G)', marginTop: 2, textTransform: 'uppercase' }}>
              {result.invoice.status}
            </div>
          </div>
        </div>
      )}

      <button className="btn" onClick={onReset}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <RotateCcw size={13} strokeWidth={2} />Nouvelle facture
      </button>
    </div>
  );
}

// ── Config Tab ────────────────────────────────────────────────────────────────

function ConfigTab() {
  const [env, setEnvState] = useState<FneEnv>(getFneEnv());
  const [token, setTokenState] = useState(getFneToken());
  const [url, setUrlState] = useState(getFneUrl());
  const [saved, setSaved] = useState(false);

  function save() {
    setFneEnv(env);
    setFneToken(token);
    if (env === 'prod') setFneUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch">
          <h3>Environnement</h3>
        </div>
        <div style={{ padding: '14px 16px', display: 'flex', gap: 10 }}>
          {(['test', 'prod'] as FneEnv[]).map(e => (
            <button
              key={e}
              onClick={() => {
                setEnvState(e);
                if (e === 'test') setUrlState(FNE_TEST_URL);
              }}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 'var(--r)', cursor: 'pointer',
                fontWeight: 600, fontSize: 12, fontFamily: 'var(--ff)',
                border: env === e ? '1.5px solid var(--G)' : '1px solid var(--bor2)',
                background: env === e ? 'rgba(0,196,98,.1)' : 'var(--sur2)',
                color: env === e ? 'var(--G)' : 'var(--tx2)',
                transition: '.12s',
              }}
            >
              {e === 'test' ? 'Test (DGI)' : 'Production'}
            </button>
          ))}
        </div>
        {env === 'test' && (
          <div style={{ padding: '0 16px 14px', fontSize: 11, color: 'var(--tx3)' }}>
            URL test : <span style={{ fontFamily: 'var(--fm)', color: 'var(--tx2)' }}>{FNE_TEST_URL}</span>
          </div>
        )}
        {env === 'prod' && (
          <div style={{ padding: '0 16px 14px' }}>
            <Field label="URL de production" value={url} onChange={e => setUrlState(e.target.value)} placeholder="https://..." />
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch">
          <h3>Clé API (Bearer Token)</h3>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <Field
            label="Token Bearer FNE"
            type="password"
            value={token}
            onChange={e => setTokenState(e.target.value)}
            placeholder="kAF01gEM40r1Uz5WLJn5lxAnGMwVjCME"
            full
          />
          <p style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 6 }}>
            Visible dans votre espace FNE → section Paramétrage (après validation DGI).
          </p>
        </div>
      </div>

      <button
        className="btn prim"
        onClick={save}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {saved ? <><CheckCircle2 size={14} strokeWidth={2} />Enregistré</> : <>Sauvegarder</>}
      </button>
    </div>
  );
}

// ── Factures existantes Tab ───────────────────────────────────────────────────

function NormaliserModal({
  facture, client, onClose, onSuccess,
}: {
  facture:   ApiFacture;
  client:    ApiClient | null;
  onClose:   () => void;
  onSuccess: (cert: FneCert) => void;
}) {
  const tvaFne = facture.tvaType === '18' ? 'TVA' : 'TVAC';

  const [template,      setTemplate]      = useState<'B2C' | 'B2G' | 'B2B' | 'B2F'>((client?.fneTemplate as 'B2C' | 'B2B' | 'B2G' | 'B2F') ?? 'B2C');
  const [paymentMethod, setPaymentMethod] = useState('mobile-money');
  const [clientNcc,     setClientNcc]     = useState(client?.ncc              ?? '');
  const [clientPhone,   setClientPhone]   = useState(client?.tel              ?? '');
  const [clientEmail,   setClientEmail]   = useState(client?.email            ?? '');
  const [clientSeller,  setClientSeller]  = useState('');
  const [pointOfSale,   setPointOfSale]   = useState(client?.fnePointOfSale   ?? '');
  const [establishment, setEstablishment] = useState(client?.fneEstablishment ?? '');
  const [loading,       setLoading]       = useState(false);
  const [err,           setErr]           = useState('');

  async function submit() {
    setErr('');
    if (!clientPhone.trim()) { setErr('Le téléphone client est requis.'); return; }
    if (!pointOfSale.trim()) { setErr('Le point de vente est requis.'); return; }
    if (!establishment.trim()) { setErr("L'établissement est requis."); return; }
    if (template === 'B2B' && !clientNcc.trim()) { setErr('Le NCC est requis pour B2B.'); return; }

    const body: FneInvoiceRequest = {
      invoiceType: 'sale',
      paymentMethod,
      template,
      isRne: false,
      ...(template === 'B2B' && { clientNcc }),
      clientCompanyName: facture.mission.client,
      clientPhone,
      clientEmail,
      ...(clientSeller && { clientSellerName: clientSeller }),
      pointOfSale,
      establishment,
      foreignCurrency: '',
      foreignCurrencyRate: 0,
      items: [{
        taxes: [tvaFne],
        reference: facture.num,
        description: facture.mission.nom,
        quantity: 1,
        amount: facture.ht,
      }],
    };

    setLoading(true);
    try {
      const res = await fneService.sign(body);
      const cert: FneCert = { reference: res.reference, token: res.token, date: new Date().toISOString() };
      saveCert(facture.id, cert);
      onSuccess(cert);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mbo on" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mod" style={{ width: 560 }}>
        <div className="mh">
          <h3>Normaliser – {facture.num}</h3>
          <button className="mx" onClick={onClose} title="Fermer">×</button>
        </div>
        <div className="mbody">
          {/* Pré-rempli */}
          <div style={{ background: 'var(--sur2)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>FACTURE</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx)', fontFamily: 'var(--fm)' }}>{facture.num}</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>CLIENT</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)' }}>{facture.mission.client}</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>MONTANT</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--G)', fontFamily: 'var(--fm)' }}>{fmt(facture.ttc)} FCFA</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>MISSION</div>
              <div style={{ fontSize: 11, color: 'var(--tx2)' }}>{facture.mission.nom}</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>TVA</div>
              <div style={{ fontSize: 11, color: 'var(--tx2)', fontFamily: 'var(--fm)' }}>
                {facture.tvaType === '18' ? 'TVA 18%' : 'Exonéré'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>DATE</div>
              <div style={{ fontSize: 11, color: 'var(--tx2)', fontFamily: 'var(--fm)' }}>{facture.date}</div>
            </div>
          </div>

          {/* Champs à compléter */}
          {client?.fneTemplate ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 'var(--r)', background: 'rgba(0,196,98,.07)', border: '1px solid var(--Gs)', marginBottom: 12 }}>
              <CheckCircle2 size={13} strokeWidth={2} color="var(--G)" />
              <span style={{ fontSize: 11, color: 'var(--G)', fontWeight: 600 }}>Infos FNE pré-remplies depuis Paramètres → Clients FNE</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 'var(--r)', background: 'var(--Al)', border: '1px solid var(--As)', marginBottom: 12 }}>
              <AlertTriangle size={13} strokeWidth={2} color="var(--A)" />
              <span style={{ fontSize: 11, color: 'var(--A)' }}>
                Aucune config FNE pour ce client. Configurez-le dans <strong>Paramètres → Clients FNE</strong> pour pré-remplir automatiquement.
              </span>
            </div>
          )}

          {/* Template */}
          <div style={{ marginBottom: 12 }}>
            <div className="lbl" style={{ marginBottom: 5 }}>Template client</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['B2C', 'B2B', 'B2G', 'B2F'] as const).map(t => (
                <button key={t} onClick={() => setTemplate(t)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 'var(--r)', cursor: 'pointer',
                    fontWeight: 600, fontSize: 11, fontFamily: 'var(--fm)',
                    border: template === t ? '1.5px solid var(--G)' : '1px solid var(--bor2)',
                    background: template === t ? 'rgba(0,196,98,.1)' : 'var(--sur2)',
                    color: template === t ? 'var(--G)' : 'var(--tx3)',
                    transition: '.12s',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Mode de paiement" as="select"
              value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="cash">Espèces</option>
              <option value="card">Carte bancaire</option>
              <option value="check">Chèque</option>
              <option value="mobile-money">Mobile money</option>
              <option value="transfer">Virement bancaire</option>
              <option value="deferred">Terme (différé)</option>
            </Field>
            {template === 'B2B' && (
              <Field label="NCC client *" value={clientNcc} onChange={e => setClientNcc(e.target.value)} placeholder="9502363N" />
            )}
            <Field label="Téléphone client *" type="tel" value={clientPhone}
              onChange={e => setClientPhone(e.target.value)} placeholder="0709080765" />
            <Field label="Email client" type="email" value={clientEmail}
              onChange={e => setClientEmail(e.target.value)} placeholder="info@client.ci" />
            <Field label="Vendeur" value={clientSeller}
              onChange={e => setClientSeller(e.target.value)} placeholder="Ali Hassan" />
            <Field label="Point de vente *" value={pointOfSale}
              onChange={e => setPointOfSale(e.target.value)} placeholder="23" />
            <Field label="Établissement *" value={establishment}
              onChange={e => setEstablishment(e.target.value)} placeholder="Orange Riviera…" full />
          </div>

          {err && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--Rl)', border: '1px solid var(--Rs)', borderRadius: 'var(--r)', marginTop: 12, color: 'var(--R)', fontSize: 12 }}>
              <AlertTriangle size={14} strokeWidth={2} />{err}
            </div>
          )}
        </div>
        <div className="mf">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn prim" onClick={submit} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? .7 : 1 }}>
            <Send size={14} strokeWidth={2} />{loading ? 'Certification…' : 'Certifier via FNE'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FacturesExistantesTab() {
  const { data: factures = [], isLoading, error } = useFactures();
  const { data: allClients = [] } = useClients();
  const [certs, setCerts] = useState<FneCerts>(getCerts);
  const [selected, setSelected] = useState<ApiFacture | null>(null);
  const [certResult, setCertResult] = useState<FneCert | null>(null);
  const [search, setSearch] = useState('');

  function getClient(facture: ApiFacture): ApiClient | null {
    return allClients.find(c => c.nom.toLowerCase() === facture.mission.client.toLowerCase()) ?? null;
  }

  const filtered = factures.filter(f =>
    f.num.toLowerCase().includes(search.toLowerCase()) ||
    f.mission.client.toLowerCase().includes(search.toLowerCase()) ||
    f.mission.nom.toLowerCase().includes(search.toLowerCase())
  );

  function handleSuccess(cert: FneCert) {
    if (!selected) return;
    const updated = { ...certs, [selected.id]: cert };
    setCerts(updated);
    setCertResult(cert);
    setSelected(null);
  }

  if (isLoading) return <QueryCard isLoading error={null} />;
  if (error) return <QueryCard isLoading={false} error={error} />;

  return (
    <>
      {certResult && (
        <div style={{ border: '1px solid var(--Gs)', borderRadius: 'var(--rl)', padding: '16px 20px', background: 'rgba(0,196,98,.04)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <CheckCircle2 size={16} color="var(--G)" strokeWidth={2} />
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--G)' }}>Facture certifiée avec succès</span>
            <button onClick={() => setCertResult(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', fontSize: 11 }}>
              Fermer
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'var(--sur2)', borderRadius: 'var(--r)', padding: '8px 10px' }}>
              <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>RÉFÉRENCE FNE</div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, color: 'var(--tx)' }}>{certResult.reference}</div>
            </div>
            <div style={{ background: 'var(--sur2)', borderRadius: 'var(--r)', padding: '8px 10px' }}>
              <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>LIEN QR CODE</div>
              <a href={certResult.token} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--B)', fontFamily: 'var(--fm)' }}>
                <ExternalLink size={10} strokeWidth={2} />Vérifier
              </a>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="kr" style={{ marginBottom: 14 }}>
        <div className="kpi">
          <div className="kpi-l">Total factures</div>
          <div className="kpi-v">{factures.length}</div>
          <div className="kpi-s">dans l'application</div>
        </div>
        <div className="kpi g">
          <div className="kpi-l">Déjà certifiées FNE</div>
          <div className="kpi-v">{Object.keys(certs).length}</div>
          <div className="kpi-s">normalisées</div>
        </div>
        <div className="kpi a">
          <div className="kpi-l">À normaliser</div>
          <div className="kpi-v">{factures.length - Object.keys(certs).length}</div>
          <div className="kpi-s">en attente</div>
        </div>
      </div>

      {/* Search */}
      <input
        className="inp"
        placeholder="Rechercher par numéro, client ou mission…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 14, maxWidth: 380 }}
      />

      <div className="card">
        <div className="ch">
          <h3>Factures</h3>
          <span className="bdg bn">{filtered.length} facture{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Mission</th>
                <th>Client</th>
                <th>Date</th>
                <th className="tr">HT</th>
                <th className="tr">TTC</th>
                <th>TVA</th>
                <th>Statut FNE</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--tx3)', padding: '20px 0' }}>Aucune facture trouvée</td></tr>
              )}
              {filtered.map(f => {
                const cert    = certs[f.id];
                const hasFne  = !!getClient(f)?.fneTemplate;
                return (
                  <tr key={f.id}>
                    <td style={{ fontFamily: 'var(--fm)', fontWeight: 600, fontSize: 11 }}>{f.num}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.mission.nom}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontWeight: 500 }}>{f.mission.client}</span>
                        {hasFne && (
                          <span style={{ fontSize: 9, fontFamily: 'var(--fm)', fontWeight: 700, color: 'var(--G)', background: 'rgba(0,196,98,.1)', padding: '1px 5px', borderRadius: 3 }} title="Infos FNE configurées">FNE</span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3)' }}>{f.date}</td>
                    <td className="tr" style={{ fontFamily: 'var(--fm)', fontSize: 11 }}>{fmt(f.ht)}</td>
                    <td className="tr" style={{ fontFamily: 'var(--fm)', fontWeight: 600 }}>{fmt(f.ttc)}</td>
                    <td>
                      <span className={`bdg ${f.tvaType === '18' ? 'bb' : 'bn'}`}>
                        {f.tvaType === '18' ? 'TVA 18%' : 'Exo.'}
                      </span>
                    </td>
                    <td>
                      {cert ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span className="bdg bg" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={9} strokeWidth={2.5} />Certifiée
                          </span>
                          <a href={cert.token} target="_blank" rel="noreferrer"
                            style={{ color: 'var(--tx3)', display: 'inline-flex' }} title="Vérifier QR">
                            <ExternalLink size={11} strokeWidth={2} />
                          </a>
                        </div>
                      ) : (
                        <span className="bdg ba">À normaliser</span>
                      )}
                    </td>
                    <td>
                      {!cert && (
                        <button
                          onClick={() => setSelected(f)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: 'var(--Bl)', border: '1px solid var(--Bs)',
                            color: 'var(--B)', borderRadius: 'var(--r)', padding: '4px 9px',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--ff)',
                          }}
                        >
                          <ArrowRight size={11} strokeWidth={2.5} />Normaliser
                        </button>
                      )}
                      {cert && (
                        <span style={{ fontSize: 10, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>
                          {cert.reference.slice(-8)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <NormaliserModal
          facture={selected}
          client={getClient(selected)}
          onClose={() => setSelected(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}

// ── Avoir Tab ─────────────────────────────────────────────────────────────────

function AvoirTab() {
  const [invoiceId, setInvoiceId] = useState('');
  const [items, setItems] = useState<AvoirItemLine[]>([{ id: '', quantity: 1, description: '' }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FneRefundResponse | null>(null);
  const [err, setErr] = useState('');

  function addItem() { setItems(prev => [...prev, { id: '', quantity: 1, description: '' }]); }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }

  function updateItem(i: number, field: keyof AvoirItemLine, val: string | number) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  }

  async function submit() {
    setErr('');
    if (!invoiceId.trim()) { setErr("L'identifiant de la facture est requis."); return; }
    if (items.some(it => !it.id.trim())) { setErr('Tous les identifiants d\'articles sont requis.'); return; }

    setLoading(true);
    try {
      const res = await fneService.refund(invoiceId.trim(), items.map(it => ({ id: it.id.trim(), quantity: it.quantity })));
      setResult(res);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  if (result) return <ResultPanel result={result} onReset={() => { setResult(null); setInvoiceId(''); setItems([{ id: '', quantity: 1, description: '' }]); }} />;

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch"><h3>Facture à créditer</h3></div>
        <div style={{ padding: '14px 16px' }}>
          <Field label="Identifiant facture (id)" value={invoiceId} onChange={e => setInvoiceId(e.target.value)}
            placeholder="e2b2d8da-a532-4c08-9182-f5b428ca468d" full />
          <p style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>
            L'id est retourné dans la réponse de certification de facture.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch">
          <h3>Articles à rembourser</h3>
          <button className="btn xs" onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Plus size={12} strokeWidth={2.5} />Ajouter
          </button>
        </div>
        <div style={{ padding: '0 16px 14px' }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px auto', gap: 8, alignItems: 'end', marginBottom: 8 }}>
              <Field label={i === 0 ? 'ID article (invoice item id)' : ''} value={it.id} onChange={e => updateItem(i, 'id', e.target.value)} placeholder="bf9cc241-9b5f-..." />
              <Field label={i === 0 ? 'Qté' : ''} type="number" value={it.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} />
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--R)', marginBottom: items.length > 1 && i === 0 ? 0 : 0, paddingBottom: 2 }}>
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {err && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--Rl)', border: '1px solid var(--Rs)', borderRadius: 'var(--r)', marginBottom: 12, color: 'var(--R)', fontSize: 12 }}>
          <AlertTriangle size={14} strokeWidth={2} />{err}
        </div>
      )}

      <button className="btn prim" onClick={submit} disabled={loading}
        style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? .7 : 1 }}>
        <Send size={14} strokeWidth={2} />{loading ? 'Envoi…' : 'Émettre l\'avoir'}
      </button>
    </div>
  );
}

// ── Certification Tab ─────────────────────────────────────────────────────────

export default function FNE() {
  const [tab, setTab] = useState<Tab>('existantes');

  // Form state
  const [invoiceType, setInvoiceType] = useState<'sale' | 'purchase'>('sale');
  const [template, setTemplate] = useState<'B2C' | 'B2G' | 'B2B' | 'B2F'>('B2C');
  const [paymentMethod, setPaymentMethod] = useState('mobile-money');
  const [isRne, setIsRne] = useState(false);
  const [rne, setRne] = useState('');
  const [clientNcc, setClientNcc] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientSeller, setClientSeller] = useState('');
  const [pointOfSale, setPointOfSale] = useState('');
  const [establishment, setEstablishment] = useState('');
  const [commercialMsg, setCommercialMsg] = useState('');
  const [footer, setFooter] = useState('');
  const [foreignCcy, setForeignCcy] = useState('');
  const [foreignRate, setForeignRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [globalCustomTaxName, setGctName] = useState('');
  const [globalCustomTaxAmount, setGctAmount] = useState(0);

  const [items, setItems] = useState<ItemLine[]>([emptyItem(1)]);
  const [itemSeq, setItemSeq] = useState(2);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FneInvoiceResponse | null>(null);
  const [err, setErr] = useState('');
  const [advOpen, setAdvOpen] = useState(false);

  const env = getFneEnv();

  // ── Items helpers ────────────────────────────────────────────────────────────

  const addItem = useCallback(() => {
    setItems(prev => [...prev, emptyItem(itemSeq)]);
    setItemSeq(s => s + 1);
  }, [itemSeq]);

  const removeItem = useCallback((id: number) => {
    setItems(prev => prev.filter(it => it.id !== id));
  }, []);

  const updateItem = useCallback((id: number, field: keyof ItemLine, val: string | number) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it));
  }, []);

  // ── Totals ───────────────────────────────────────────────────────────────────

  const totalHt = items.reduce((s, it) => s + calcHt(it.amount, it.quantity, it.discount), 0);
  const totalTva = items.reduce((s, it) => s + calcTva(it.amount, it.quantity, it.discount, it.tva), 0);
  const totalHtAfterDisc = Math.round(totalHt * (1 - discount / 100));
  const totalTtc = totalHtAfterDisc + totalTva;

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function submit() {
    setErr('');

    // Validation
    if (!clientCompany.trim()) { setErr('Le nom du client/fournisseur est requis.'); return; }
    if (!clientPhone.trim()) { setErr('Le téléphone client est requis.'); return; }
    if (!pointOfSale.trim()) { setErr('Le point de vente est requis.'); return; }
    if (!establishment.trim()) { setErr("L'établissement est requis."); return; }
    if (template === 'B2B' && !clientNcc.trim()) { setErr('Le NCC client est requis pour le template B2B.'); return; }
    if (template === 'B2F' && foreignCcy && !foreignRate) { setErr('Le taux de change est requis pour une devise étrangère.'); return; }
    if (isRne && !rne.trim()) { setErr("Le numéro de reçu (RNE) est requis."); return; }
    if (items.some(it => !it.description.trim())) { setErr("La description de chaque article est requise."); return; }

    const body: FneInvoiceRequest = {
      invoiceType,
      paymentMethod,
      template,
      isRne,
      ...(isRne && { rne }),
      ...(template === 'B2B' && { clientNcc }),
      clientCompanyName: clientCompany,
      clientPhone,
      clientEmail,
      ...(clientSeller && { clientSellerName: clientSeller }),
      pointOfSale,
      establishment,
      ...(commercialMsg && { commercialMessage: commercialMsg }),
      ...(footer && { footer }),
      foreignCurrency: foreignCcy || '',
      foreignCurrencyRate: foreignRate || 0,
      discount: discount || undefined,
      ...(globalCustomTaxName && {
        customTaxes: [{ name: globalCustomTaxName, amount: globalCustomTaxAmount }],
      }),
      items: items.map(it => ({
        taxes: [it.tva],
        ...(it.customTaxName && { customTaxes: [{ name: it.customTaxName, amount: it.customTaxAmount }] }),
        ...(it.reference && { reference: it.reference }),
        description: it.description,
        quantity: it.quantity,
        amount: it.amount,
        ...(it.discount && { discount: it.discount }),
        ...(it.measurementUnit && { measurementUnit: it.measurementUnit }),
      })),
    };

    setLoading(true);
    try {
      const res = await fneService.sign(body);
      setResult(res);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null); setErr('');
    setClientCompany(''); setClientPhone(''); setClientEmail('');
    setClientNcc(''); setClientSeller(''); setPointOfSale(''); setEstablishment('');
    setCommercialMsg(''); setFooter(''); setForeignCcy(''); setForeignRate(0);
    setDiscount(0); setGctName(''); setGctAmount(0); setIsRne(false); setRne('');
    setItems([emptyItem(1)]); setItemSeq(2);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="pg">
      {/* Header */}
      <div className="ph">
        <div className="ph-l">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCheck2 size={18} strokeWidth={2} />
            FNE – Facture Normalisée
          </h1>
          <p>Certification des factures via l'API DGI – Côte d'Ivoire</p>
        </div>
        <div className="ph-r" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {badge(env)}
          <button
            className="btn xs"
            onClick={() => setTab('config')}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Settings2 size={12} strokeWidth={2} />Config
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {([
          { v: 'existantes', l: 'Mes factures' },
          { v: 'certifier', l: 'Nouvelle facture' },
          { v: 'avoir', l: 'Avoir / Remboursement' },
          { v: 'config', l: 'Configuration' },
        ] as { v: Tab; l: string }[]).map(t => (
          <button key={t.v} className={`tab${tab === t.v ? ' on' : ''}`} onClick={() => setTab(t.v)}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── Existantes ── */}
      {tab === 'existantes' && <FacturesExistantesTab />}

      {/* ── Config ── */}
      {tab === 'config' && <ConfigTab />}

      {/* ── Avoir ── */}
      {tab === 'avoir' && <AvoirTab />}

      {/* ── Certifier ── */}
      {tab === 'certifier' && (
        <>
          {result ? (
            <ResultPanel result={result} onReset={reset} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14, alignItems: 'start' }}>
              {/* ── Left column ── */}
              <div>
                {/* Section 1 : Type & template */}
                <div className="card" style={{ marginBottom: 14 }}>
                  <div className="ch"><h3>Type de facture</h3></div>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                      {/* Invoice type */}
                      <div>
                        <div className="lbl" style={{ marginBottom: 6 }}>Nature</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(['sale', 'purchase'] as const).map(v => (
                            <button key={v} onClick={() => setInvoiceType(v)}
                              style={{
                                flex: 1, padding: '7px 0', borderRadius: 'var(--r)', cursor: 'pointer',
                                fontWeight: 600, fontSize: 11.5, fontFamily: 'var(--ff)',
                                border: invoiceType === v ? '1.5px solid var(--B)' : '1px solid var(--bor2)',
                                background: invoiceType === v ? 'var(--Bl)' : 'var(--sur2)',
                                color: invoiceType === v ? 'var(--B)' : 'var(--tx2)',
                                transition: '.12s',
                              }}>
                              {v === 'sale' ? 'Vente' : 'Achat'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Payment */}
                      <Field label="Mode de paiement" as="select"
                        value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                        {PAYMENT_METHODS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                      </Field>
                    </div>

                    {/* Template */}
                    <div>
                      <div className="lbl" style={{ marginBottom: 6 }}>Template client</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {TEMPLATES.map(t => (
                          <button key={t.v} onClick={() => setTemplate(t.v as typeof template)}
                            style={{
                              padding: '6px 12px', borderRadius: 'var(--r)', cursor: 'pointer',
                              fontWeight: 600, fontSize: 11, fontFamily: 'var(--fm)',
                              border: template === t.v ? '1.5px solid var(--G)' : '1px solid var(--bor2)',
                              background: template === t.v ? 'rgba(0,196,98,.1)' : 'var(--sur2)',
                              color: template === t.v ? 'var(--G)' : 'var(--tx3)',
                              transition: '.12s',
                            }}>
                            {t.v}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--tx3)', marginTop: 5 }}>
                        {TEMPLATES.find(t => t.v === template)?.l}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2 : Client */}
                <div className="card" style={{ marginBottom: 14 }}>
                  <div className="ch">
                    <h3>{invoiceType === 'sale' ? 'Informations client' : 'Informations fournisseur'}</h3>
                  </div>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {template === 'B2B' && (
                        <Field label="NCC client *" value={clientNcc} onChange={e => setClientNcc(e.target.value)} placeholder="9502363N" />
                      )}
                      <Field label={invoiceType === 'sale' ? 'Nom société / client *' : 'Nom fournisseur *'}
                        value={clientCompany} onChange={e => setClientCompany(e.target.value)}
                        placeholder="KPMG FRANCE" full={template !== 'B2B'} />
                      <Field label="Téléphone *" type="tel" value={clientPhone}
                        onChange={e => setClientPhone(e.target.value)} placeholder="0709080765" />
                      <Field label="Email" type="email" value={clientEmail}
                        onChange={e => setClientEmail(e.target.value)} placeholder="info@client.ci" />
                      <Field label="Vendeur" value={clientSeller}
                        onChange={e => setClientSeller(e.target.value)} placeholder="Ali Hassan" />
                      <Field label="Point de vente *" value={pointOfSale}
                        onChange={e => setPointOfSale(e.target.value)} placeholder="23" />
                      <Field label="Établissement *" value={establishment}
                        onChange={e => setEstablishment(e.target.value)} placeholder="Orange Riviera Mpouto" full />
                    </div>

                    {/* RNE */}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bor)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                        <input type="checkbox" checked={isRne} onChange={e => setIsRne(e.target.checked)}
                          style={{ accentColor: 'var(--G)', width: 14, height: 14 }} />
                        <span style={{ fontSize: 12, color: 'var(--tx2)' }}>Facture liée à un reçu (RNE)</span>
                      </label>
                      {isRne && (
                        <div style={{ marginTop: 8 }}>
                          <Field label="Numéro de reçu (RNE) *" value={rne} onChange={e => setRne(e.target.value)} placeholder="RNE-2025-001" />
                        </div>
                      )}
                    </div>

                    {/* Devise (B2F) */}
                    {template === 'B2F' && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bor)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <Field label="Devise étrangère" as="select"
                          value={foreignCcy} onChange={e => setForeignCcy(e.target.value)}>
                          {CURRENCIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                        </Field>
                        {foreignCcy && (
                          <Field label={`Taux (1 ${foreignCcy} = ? FCFA) *`} type="number"
                            value={foreignRate} onChange={e => setForeignRate(parseFloat(e.target.value) || 0)} />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3 : Articles */}
                <div className="card" style={{ marginBottom: 14 }}>
                  <div className="ch">
                    <h3>Articles</h3>
                    <button className="btn xs" onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Plus size={12} strokeWidth={2.5} />Ajouter un article
                    </button>
                  </div>
                  <div style={{ padding: '0 16px 14px' }}>
                    {items.map((it, idx) => (
                      <div key={it.id} style={{ borderTop: idx > 0 ? '1px solid var(--bor)' : 'none', paddingTop: idx > 0 ? 14 : 0, marginTop: idx > 0 ? 14 : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>Article {idx + 1}</span>
                          {items.length > 1 && (
                            <button onClick={() => removeItem(it.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--R)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                              <Trash2 size={12} strokeWidth={2} />Retirer
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <Field label="Description *" value={it.description}
                            onChange={e => updateItem(it.id, 'description', e.target.value)}
                            placeholder="Sac de riz Dinor 5x5" />
                          <Field label="Référence" value={it.reference}
                            onChange={e => updateItem(it.id, 'reference', e.target.value)}
                            placeholder="ref009" />
                          <Field label="Quantité *" type="number" value={it.quantity}
                            onChange={e => updateItem(it.id, 'quantity', parseFloat(e.target.value) || 0)} />
                          <Field label="Prix unitaire HT (FCFA) *" type="number" value={it.amount}
                            onChange={e => updateItem(it.id, 'amount', parseFloat(e.target.value) || 0)} />
                          <Field label="Remise (%)" type="number" value={it.discount}
                            onChange={e => updateItem(it.id, 'discount', parseFloat(e.target.value) || 0)} />
                          <Field label="Unité de mesure" value={it.measurementUnit}
                            onChange={e => updateItem(it.id, 'measurementUnit', e.target.value)}
                            placeholder="pcs, kg, bidon…" />
                          <Field label="TVA *" as="select" value={it.tva}
                            onChange={e => updateItem(it.id, 'tva', e.target.value)}>
                            {TVA_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                          </Field>
                          <div>
                            <div className="lbl" style={{ marginBottom: 4 }}>Taxe additionnelle</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 6 }}>
                              <input className="inp" placeholder="Nom (GRA, AIRSI…)"
                                value={it.customTaxName} onChange={e => updateItem(it.id, 'customTaxName', e.target.value)} />
                              <input className="inp" type="number" placeholder="%"
                                value={it.customTaxAmount || ''} onChange={e => updateItem(it.id, 'customTaxAmount', parseFloat(e.target.value) || 0)} />
                            </div>
                          </div>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>
                          HT : {calcHt(it.amount, it.quantity, it.discount).toLocaleString('fr-FR')} FCFA
                          &nbsp;· TVA : {calcTva(it.amount, it.quantity, it.discount, it.tva).toLocaleString('fr-FR')} FCFA
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 4 : Options avancées */}
                <div className="card" style={{ marginBottom: 14 }}>
                  <button
                    onClick={() => setAdvOpen(v => !v)}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', color: 'var(--tx2)', fontFamily: 'var(--ff)', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <span>Options avancées (remise globale, taxes, messages)</span>
                    {advOpen ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
                  </button>
                  {advOpen && (
                    <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--bor)' }}>
                      <div style={{ paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <Field label="Remise globale sur HT total (%)" type="number"
                          value={discount || ''} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 6 }}>
                          <Field label="Taxe globale (ex: DTD)"
                            value={globalCustomTaxName} onChange={e => setGctName(e.target.value)} placeholder="DTD" />
                          <Field label="%" type="number"
                            value={globalCustomTaxAmount || ''} onChange={e => setGctAmount(parseFloat(e.target.value) || 0)} />
                        </div>
                        <Field label="Message commercial" value={commercialMsg}
                          onChange={e => setCommercialMsg(e.target.value)} placeholder="Soyez les bienvenus" full />
                        <Field label="Message pied de page" value={footer}
                          onChange={e => setFooter(e.target.value)} placeholder="Toujours là pour votre bonheur" full />
                      </div>
                    </div>
                  )}
                </div>

                {/* Error */}
                {err && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--Rl)', border: '1px solid var(--Rs)', borderRadius: 'var(--r)', marginBottom: 12, color: 'var(--R)', fontSize: 12 }}>
                    <AlertTriangle size={14} strokeWidth={2} />{err}
                  </div>
                )}

                <button className="btn prim" onClick={submit} disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? .7 : 1 }}>
                  <Send size={14} strokeWidth={2} />
                  {loading ? 'Certification en cours…' : 'Certifier la facture'}
                </button>
              </div>

              {/* ── Right column: Summary ── */}
              <div style={{ position: 'sticky', top: 16 }}>
                <div className="card">
                  <div className="ch"><h3>Récapitulatif</h3></div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: 'var(--tx3)', fontFamily: 'var(--fm)', marginBottom: 2 }}>TYPE</div>
                      <div style={{ fontSize: 12, color: 'var(--tx)', fontWeight: 600 }}>
                        {invoiceType === 'sale' ? 'Facture de vente' : 'Facture d\'achat'}
                        &nbsp;· <span style={{ color: 'var(--G)', fontFamily: 'var(--fm)' }}>{template}</span>
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: 'var(--tx3)', fontFamily: 'var(--fm)', marginBottom: 2 }}>PAIEMENT</div>
                      <div style={{ fontSize: 12, color: 'var(--tx)' }}>
                        {PAYMENT_METHODS.find(m => m.v === paymentMethod)?.l}
                      </div>
                    </div>
                    {clientCompany && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: 'var(--tx3)', fontFamily: 'var(--fm)', marginBottom: 2 }}>CLIENT</div>
                        <div style={{ fontSize: 12, color: 'var(--tx)', wordBreak: 'break-word' }}>{clientCompany}</div>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid var(--bor)', paddingTop: 10, marginTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--tx3)' }}>Articles</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--fm)', color: 'var(--tx2)' }}>{items.length}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--tx3)' }}>HT total</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--fm)', color: 'var(--tx)' }}>
                          {totalHt.toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                      {discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 11, color: 'var(--tx3)' }}>Remise {discount}%</span>
                          <span style={{ fontSize: 11, fontFamily: 'var(--fm)', color: 'var(--R)' }}>
                            -{(totalHt - totalHtAfterDisc).toLocaleString('fr-FR')} FCFA
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--tx3)' }}>TVA</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--fm)', color: 'var(--tx2)' }}>
                          {totalTva.toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--bor)', marginTop: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>TTC</span>
                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--fm)', color: 'var(--G)' }}>
                          {totalTtc.toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Token status */}
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 'var(--r)', background: getFneToken() ? 'rgba(0,196,98,.07)' : 'var(--Rl)', border: `1px solid ${getFneToken() ? 'var(--Gs)' : 'var(--Rs)'}` }}>
                  <div style={{ fontSize: 10, color: getFneToken() ? 'var(--G)' : 'var(--R)', fontFamily: 'var(--fm)', fontWeight: 600 }}>
                    {getFneToken() ? '● TOKEN CONFIGURÉ' : '● TOKEN MANQUANT'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>
                    {env === 'test' ? 'Env. test DGI' : 'Env. production'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
