import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { loginSchema } from '../schemas';
import { useForm } from '../hooks/useForm';
import { loginRequest } from '../services/auth.service';
import { ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../router/routes';

// ─── Register schema ─────────────────────────────────────────────────
const registerSchema = z.object({
  prenom: z.string().min(1, 'Requis'),
  nom: z.string().min(1, 'Requis'),
  email: z.email('Email invalide'),
  organisation: z.string().min(1, 'Requis'),
  pays: z.string().min(1, 'Requis'),
  role: z.string(),
  password: z.string().min(6, 'Minimum 6 caractères'),
  terms: z.literal(true, { error: 'Vous devez accepter les conditions' }),
});
// type RegisterInput = z.infer<typeof registerSchema>;

// ─── Password strength ───────────────────────────────────────────────
function getStrength(v: string): { score: number; label: string } {
  let score = 0;
  if (v.length >= 8) score++;
  if (v.length >= 12) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v)) score++;
  const label = score === 0 ? '—' : ['Faible', 'Faible', 'Moyenne', 'Forte'][score - 1];
  return { score, label };
}

// ─── SVG icons ───────────────────────────────────────────────────────
const IconEmail = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);
const IconLock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconEye = ({ off }: { off?: boolean }) => off
  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
  </svg>
);
const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconBriefcase = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const IconGlobe = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const IconChevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ─── OAuth buttons ────────────────────────────────────────────────────
const GoogleSvg = () => (
  <svg viewBox="0 0 24 24" width="16" height="16">
    <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.32z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.85 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.67-2.83z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.67 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);
const LinkedinSvg = () => (
  <svg viewBox="0 0 24 24" fill="#0A66C2" width="16" height="16">
    <path d="M19 0H5a5 5 0 0 0-5 5v14a5 5 0 0 0 5 5h14a5 5 0 0 0 5-5V5a5 5 0 0 0-5-5zM8 19H5V8h3v11zM6.5 6.7a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4zM20 19h-3v-5.6c0-3.4-4-3.1-4 0V19h-3V8h3v1.8c1.4-2.6 7-2.8 7 2.5V19z" />
  </svg>
);

// ─── Input wrapper ────────────────────────────────────────────────────
function InputWrap({ icon, error, children }: { icon?: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#fff', border: `1px solid ${error ? '#C2410C' : 'rgba(17,24,39,0.14)'}`,
        borderRadius: 7, padding: '0 11px',
        transition: 'border-color 120ms, box-shadow 120ms',
        boxShadow: error ? '0 0 0 3px rgba(194,65,12,0.1)' : undefined,
      }}
        onFocus={(e) => { if (!error) (e.currentTarget as HTMLElement).style.cssText += 'border-color:#185FA5;box-shadow:0 0 0 3px rgba(24,95,165,0.08)'; }}
        onBlur={(e) => { if (!error) (e.currentTarget as HTMLElement).style.cssText = (e.currentTarget as HTMLElement).style.cssText.replace(/border-color:[^;]+;box-shadow:[^;]+;/, ''); }}
      >
        {icon && <span style={{ color: '#8A93A1', flexShrink: 0, display: 'flex' }}>{icon}</span>}
        {children}
      </div>
      {error && <span style={{ fontSize: 11, color: '#C2410C', marginTop: 4, display: 'block' }}>{error}</span>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1, border: 'none', outline: 'none', background: 'transparent',
  padding: '9px 0', fontSize: 14, color: '#0B0E14', fontFamily: '"Inter Tight", system-ui, sans-serif',
};
const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: 'none', WebkitAppearance: 'none', paddingRight: 22, cursor: 'pointer',
};

export default function Auth() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || ROUTES.DASHBOARD;

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPwLogin, setShowPwLogin] = useState(false);
  const [showPwReg, setShowPwReg] = useState(false);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loginForm = useForm(loginSchema, { email: '', password: '' });
  const registerForm = useForm(registerSchema, {
    prenom: '', nom: '', email: '', organisation: '', pays: "Côte d'Ivoire",
    role: '', password: '', terms: false as never,
  });

  const strength = getStrength(registerForm.values.password);
  const segColor = (i: number) => {
    if (i >= strength.score) return 'rgba(17,24,39,0.1)';
    return strength.score <= 2 ? '#C2410C' : strength.score === 3 ? '#B7791F' : '#0E8F7E';
  };

  async function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!loginForm.validate()) return;
    setSubmitting(true); setServerError('');
    try {
      const { token, user } = await loginRequest(loginForm.values);
      login(token, user);
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Erreur de connexion');
    } finally { setSubmitting(false); }
  }

  async function handleRegister(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!registerForm.validate()) return;
    setSubmitting(true); setServerError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${registerForm.values.prenom} ${registerForm.values.nom}`.trim(),
          email: registerForm.values.email,
          password: registerForm.values.password,
          role: 'VIEWER',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.message || 'Erreur inscription');
      const { token, user } = await loginRequest({ email: registerForm.values.email, password: registerForm.values.password });
      login(token, user);
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Erreur');
    } finally { setSubmitting(false); }
  }

  // ── shared OAuth buttons
  const oauthButtons = (mode: 'login' | 'register') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
      {[
        { icon: <GoogleSvg />, label: mode === 'login' ? 'Continuer avec Google' : 'S\'inscrire avec Google' },
        ...(mode === 'login' ? [{ icon: <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.802.06 4.207 2.5-.103.062-2.485 1.45-2.485 4.42 0 3.36 2.943 4.55 3.038 4.61z" /></svg>, label: 'Continuer avec Apple' }] : []),
        { icon: <LinkedinSvg />, label: mode === 'login' ? 'Continuer avec LinkedIn' : 'S\'inscrire avec LinkedIn' },
      ].map(({ icon, label }) => (
        <button key={label} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          padding: '9px 12px', border: '1px solid rgba(17,24,39,0.14)',
          background: '#fff', borderRadius: 7, cursor: 'pointer',
          fontSize: 13.5, fontWeight: 500, color: '#0B0E14',
          fontFamily: '"Inter Tight", system-ui, sans-serif', transition: 'background 120ms',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F6F7F9')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          type="button"
        >
          {icon}{label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh', width: "100%",
      fontFamily: '"Inter Tight", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased', letterSpacing: '-0.005em',
    }}>
      {/* ─── Visual side ─── */}
      <aside style={{
        background: '#0B0E14', color: '#ECEEF2',
        padding: '32px 40px 40px', position: 'relative',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* gradient */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 600px 400px at 70% 20%, rgba(24,95,165,0.28), transparent 60%), radial-gradient(ellipse 500px 500px at 20% 90%, rgba(109,62,171,0.18), transparent 60%)',
        }} />

        {/* brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 2 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600 }}>◈</div>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#fff', letterSpacing: '-0.015em' }}>Marabu</span>
        </div>

        {/* pitch */}
        <div style={{ marginTop: 96, position: 'relative', zIndex: 2, maxWidth: 480 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            fontSize: 11.5, color: 'rgba(236,238,242,0.7)',
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 18,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0E8F7E', animation: 'pulse-dot 1.6s ease-in-out infinite', display: 'inline-block' }} />
            Tableau de bord COO · Marabu Services
          </div>

          <h1 style={{ fontSize: 38, lineHeight: 1.12, letterSpacing: '-0.025em', fontWeight: 600, margin: '0 0 20px', textWrap: 'balance' as never }}>
            Pilotez vos missions, vos charges et votre{' '}
            <em style={{ fontStyle: 'normal', color: '#4D9DE8', fontWeight: 600 }}>trésorerie en temps réel.</em>
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(236,238,242,0.65)', lineHeight: 1.55, margin: '0 0 28px' }}>
            Vision COO complète — pipeline missions, facturation, salaires, charges, BFR prévisionnel. Tout ce dont vous avez besoin pour décider vite.
          </p>

          {/* mini card */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 11, padding: '16px 18px', backdropFilter: 'blur(10px)', marginTop: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, background: '#185FA5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>M</div>
                Marabu COO
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(236,238,242,0.55)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#0E8F7E', display: 'inline-block', animation: 'pulse-dot 1.2s ease-in-out infinite' }} />
                en cours
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              {[
                { label: '4 missions actives', bg: 'rgba(77,157,232,0.18)', color: '#6BB0EF' },
                { label: '41M FCFA encaissés', bg: 'rgba(61,191,168,0.18)', color: '#6FD4BF' },
                { label: 'BFR +32M', bg: 'rgba(165,120,224,0.18)', color: '#C09CEC' },
                { label: 'Avril 2026', bg: 'rgba(224,160,69,0.18)', color: '#ECBD7B' },
              ].map(c => (
                <span key={c.label} style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 500, background: c.bg, color: c.color }}>{c.label}</span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { done: true, label: 'Encaissements Avril synchronisés' },
                { done: true, label: 'Salaires 15 collaborateurs vérifiés' },
                { active: true, label: 'Projection BFR Mai–Déc calculée' },
                { label: 'Export rapport mensuel COO' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: s.done || s.active ? '#ECEEF2' : 'rgba(236,238,242,0.35)' }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                    background: s.done ? '#0E8F7E' : 'transparent',
                    border: s.active ? '1.5px solid #4D9DE8' : s.done ? 'none' : '1.5px solid rgba(255,255,255,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: s.active ? 'pulse-ring-d 1.4s ease-in-out infinite' : 'none',
                  }}>
                    {s.done && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* testimonial */}
        <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)', position: 'relative', zIndex: 2 }}>
          <blockquote style={{ fontSize: 14.5, lineHeight: 1.55, color: '#ECEEF2', margin: '0 0 14px', maxWidth: 460 }}>
            « Avant, je compilais les chiffres dans trois Excel différents. Avec le tableau de bord, le COO a tout en un coup d'œil et on gagne deux heures par semaine. »
          </blockquote>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#4D9DE8,#A578E0)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>OA</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Ouattara Aïda</div>
              <div style={{ fontSize: 12, color: 'rgba(236,238,242,0.55)' }}>Directrice associée COO · Marabu Services</div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes pulse-dot { 0%,100%{opacity:.4;transform:scale(.85)} 50%{opacity:1;transform:scale(1.15)} }
          @keyframes pulse-ring-d { 0%,100%{box-shadow:0 0 0 0 rgba(77,157,232,0.4)} 50%{box-shadow:0 0 0 4px rgba(77,157,232,0)} }
          @keyframes fade-in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
          @media(max-width:900px){ .auth-visual{display:none!important} .auth-grid{grid-template-columns:1fr!important} }
        `}</style>
      </aside>

      {/* ─── Form side ─── */}
      <main style={{ display: 'flex', flexDirection: 'column', padding: '24px 32px 32px', background: '#FCFCFD' }}>
        {/* top bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#8A93A1', fontSize: 12.5 }}>
            {tab === 'login' ? 'Pas encore de compte ?' : 'Vous avez déjà un compte ?'}
          </span>
          <button onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setServerError(''); }} style={{
            color: '#185FA5', fontWeight: 500, padding: '5px 11px',
            border: '1px solid rgba(24,95,165,0.22)', background: 'rgba(24,95,165,0.08)',
            borderRadius: 7, cursor: 'pointer', fontSize: 13,
            fontFamily: '"Inter Tight", system-ui, sans-serif',
          }}>
            {tab === 'login' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </div>

        {/* form card */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
          <div style={{ width: '100%', maxWidth: 380 }}>

            {/* tabs */}
            {/* <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#F6F7F9', padding: 3, borderRadius: 8, marginBottom: 28, border: '1px solid rgba(17,24,39,0.08)' }}>
              {(['login', 'register'] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); setServerError(''); }} style={{
                  padding: 7, border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontSize: 13, fontWeight: 500, transition: 'all 150ms',
                  fontFamily: '"Inter Tight", system-ui, sans-serif',
                  background: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? '#0B0E14' : '#5B6472',
                  boxShadow: tab === t ? '0 1px 0 rgba(0,0,0,0.04),0 1px 2px rgba(0,0,0,0.04)' : 'none',
                }}>
                  {t === 'login' ? 'Connexion' : 'Inscription'}
                </button>
              ))}
            </div> */}

            {/* error */}
            {serverError && (
              <div style={{ background: 'rgba(194,65,12,0.08)', border: '1px solid rgba(194,65,12,0.2)', borderRadius: 7, padding: '10px 12px', fontSize: 13, color: '#C2410C', marginBottom: 16, display: 'flex', gap: 8 }}>
                <AlertTriangle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>{serverError}</span>
              </div>
            )}

            {/* ── LOGIN ── */}
            {tab === 'login' && (
              <div style={{ animation: 'fade-in 200ms ease' }}>
                <h2 style={{ fontSize: 26, lineHeight: 1.18, letterSpacing: '-0.022em', fontWeight: 600, margin: '0 0 8px', color: '#0B0E14' }}>Bon retour.</h2>
                <p style={{ fontSize: 14, color: '#5B6472', margin: '0 0 24px', lineHeight: 1.5 }}>Reprenez votre travail là où vous l'avez laissé.</p>

                {/* {oauthButtons('login')} */}

                {/* <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0 18px', color: '#8A93A1', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(17,24,39,0.08)' }} />
                  ou avec votre email
                  <div style={{ flex: 1, height: 1, background: 'rgba(17,24,39,0.08)' }} />
                </div> */}

                <form onSubmit={handleLogin} noValidate>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: '#0B0E14', marginBottom: 6 }}>Email professionnel</label>
                    <InputWrap icon={<IconEmail />} error={loginForm.errors.email}>
                      <input style={inputStyle} type="email" placeholder="vous@marabu.ci" autoComplete="email"
                        value={loginForm.values.email} onChange={e => loginForm.set('email', e.target.value)} />
                    </InputWrap>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <label style={{ fontSize: 12.5, fontWeight: 500, color: '#0B0E14' }}>Mot de passe</label>
                      <a href="#" style={{ color: '#185FA5', fontSize: 12, textDecoration: 'none', fontWeight: 500 }} onClick={e => e.preventDefault()}>Mot de passe oublié ?</a>
                    </div>
                    <InputWrap icon={<IconLock />} error={loginForm.errors.password}>
                      <input style={inputStyle} type={showPwLogin ? 'text' : 'password'} placeholder="••••••••••" autoComplete="current-password"
                        value={loginForm.values.password} onChange={e => loginForm.set('password', e.target.value)} />
                      <button type="button" onClick={() => setShowPwLogin(!showPwLogin)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A93A1', padding: 4, display: 'flex' }}>
                        <IconEye off={showPwLogin} />
                      </button>
                    </InputWrap>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '6px 0 18px', fontSize: 12.5, color: '#5B6472' }}>
                    <input type="checkbox" id="remember" defaultChecked style={{ margin: '2px 0 0', accentColor: '#185FA5', cursor: 'pointer', width: 14, height: 14 }} />
                    <label htmlFor="remember" style={{ fontWeight: 400, cursor: 'pointer' }}>Rester connecté sur cet appareil</label>
                  </div>
                  <button type="submit" disabled={submitting} style={{
                    width: '100%', padding: 11, border: 'none',
                    background: submitting ? '#5B96D0' : '#185FA5', color: '#fff',
                    fontSize: 14, fontWeight: 500, fontFamily: '"Inter Tight", system-ui, sans-serif',
                    borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 120ms',
                  }}>
                    {submitting ? <><Loader2 size={14} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> Connexion…</> : <>Se connecter <IconArrow /></>}
                  </button>
                </form>

                <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(17,24,39,0.08)', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#8A93A1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#0E8F7E', display: 'flex' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L3 7l9 5 9-5-9-5z" /><path d="M3 17l9 5 9-5" /><path d="M3 12l9 5 9-5" /></svg></span>
                    Données hébergées en zone UEMOA · conformité RGPD CEDEAO
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: '#5B6472' }}>
                  Première fois sur Marabu ?{' '}
                  <a href="#" onClick={e => { e.preventDefault(); setTab('register'); setServerError(''); }} style={{ color: '#185FA5', textDecoration: 'none', fontWeight: 500 }}>Créer un compte gratuit</a>
                </div>
              </div>
            )}

            {/* ── REGISTER ── */}
            {tab === 'register' && (
              <div style={{ animation: 'fade-in 200ms ease' }}>
                <h2 style={{ fontSize: 26, lineHeight: 1.18, letterSpacing: '-0.022em', fontWeight: 600, margin: '0 0 8px', color: '#0B0E14' }}>Créez votre compte.</h2>
                <p style={{ fontSize: 14, color: '#5B6472', margin: '0 0 24px', lineHeight: 1.5 }}>Accès complet au tableau de bord COO.</p>

                {oauthButtons('register')}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0 18px', color: '#8A93A1', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(17,24,39,0.08)' }} />
                  ou inscription par email
                  <div style={{ flex: 1, height: 1, background: 'rgba(17,24,39,0.08)' }} />
                </div>

                <form onSubmit={handleRegister} noValidate>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[
                      { key: 'prenom' as const, label: 'Prénom', placeholder: 'Aïcha', autoComplete: 'given-name' },
                      { key: 'nom' as const, label: 'Nom', placeholder: 'Koné', autoComplete: 'family-name' },
                    ].map(({ key, label, placeholder, autoComplete }) => (
                      <div key={key}>
                        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: '#0B0E14', marginBottom: 6 }}>{label}</label>
                        <InputWrap error={registerForm.errors[key]}>
                          <input style={inputStyle} type="text" placeholder={placeholder} autoComplete={autoComplete}
                            value={registerForm.values[key]} onChange={e => registerForm.set(key, e.target.value)} />
                        </InputWrap>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: '#0B0E14', marginBottom: 6 }}>Email professionnel</label>
                    <InputWrap icon={<IconEmail />} error={registerForm.errors.email}>
                      <input style={inputStyle} type="email" placeholder="aicha.kone@cabinet.ci" autoComplete="email"
                        value={registerForm.values.email} onChange={e => registerForm.set('email', e.target.value)} />
                    </InputWrap>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: '#0B0E14', marginBottom: 6 }}>Organisation</label>
                      <InputWrap icon={<IconBriefcase />} error={registerForm.errors.organisation}>
                        <input style={inputStyle} type="text" placeholder="Marabu Services"
                          value={registerForm.values.organisation} onChange={e => registerForm.set('organisation', e.target.value)} />
                      </InputWrap>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: '#0B0E14', marginBottom: 6 }}>Pays</label>
                      <InputWrap icon={<IconGlobe />} error={registerForm.errors.pays}>
                        <select style={selectStyle} value={registerForm.values.pays} onChange={e => registerForm.set('pays', e.target.value)}>
                          {["Côte d'Ivoire", 'Sénégal', 'Bénin', 'Togo', 'Burkina Faso', 'Mali', 'Niger', 'Guinée', 'Autre'].map(p => <option key={p}>{p}</option>)}
                        </select>
                        <span style={{ color: '#8A93A1', display: 'flex', flexShrink: 0 }}><IconChevron /></span>
                      </InputWrap>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: '#0B0E14', marginBottom: 6 }}>
                      Rôle <span style={{ color: '#8A93A1', fontWeight: 400, marginLeft: 4, fontSize: 11 }}>— optionnel</span>
                    </label>
                    <InputWrap icon={<IconUser />}>
                      <select style={selectStyle} value={registerForm.values.role} onChange={e => registerForm.set('role', e.target.value)}>
                        <option value="">Sélectionner un rôle</option>
                        {['COO / Directeur des opérations', 'Directeur financier', 'Consultant', 'Manager', 'Autre'].map(r => <option key={r}>{r}</option>)}
                      </select>
                      <span style={{ color: '#8A93A1', display: 'flex', flexShrink: 0 }}><IconChevron /></span>
                    </InputWrap>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: '#0B0E14', marginBottom: 6 }}>Mot de passe</label>
                    <InputWrap icon={<IconLock />} error={registerForm.errors.password}>
                      <input style={inputStyle} type={showPwReg ? 'text' : 'password'} placeholder="Minimum 6 caractères" autoComplete="new-password"
                        value={registerForm.values.password} onChange={e => registerForm.set('password', e.target.value)} />
                      <button type="button" onClick={() => setShowPwReg(!showPwReg)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A93A1', padding: 4, display: 'flex' }}>
                        <IconEye off={showPwReg} />
                      </button>
                    </InputWrap>
                    {registerForm.values.password && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 6 }}>
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} style={{ height: 3, flex: 1, background: segColor(i), borderRadius: 2, transition: 'background 200ms' }} />
                        ))}
                        <span style={{ fontSize: 11, color: '#8A93A1', marginLeft: 8, whiteSpace: 'nowrap' }}>Force {strength.label}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '6px 0 18px', fontSize: 12.5, color: '#5B6472' }}>
                    <input type="checkbox" id="terms" checked={registerForm.values.terms as boolean}
                      onChange={e => registerForm.set('terms', e.target.checked as never)}
                      style={{ margin: '2px 0 0', accentColor: '#185FA5', cursor: 'pointer', width: 14, height: 14 }} />
                    <label htmlFor="terms" style={{ fontWeight: 400, cursor: 'pointer', lineHeight: 1.5 }}>
                      J'accepte les <a href="#" style={{ color: '#185FA5', textDecoration: 'none' }} onClick={e => e.preventDefault()}>conditions d'utilisation</a> et la <a href="#" style={{ color: '#185FA5', textDecoration: 'none' }} onClick={e => e.preventDefault()}>politique de confidentialité</a>.
                    </label>
                  </div>
                  {registerForm.errors.terms && <div style={{ fontSize: 11, color: '#C2410C', marginBottom: 10 }}>{registerForm.errors.terms}</div>}

                  <button type="submit" disabled={submitting} style={{
                    width: '100%', padding: 11, border: 'none',
                    background: submitting ? '#5B96D0' : '#185FA5', color: '#fff',
                    fontSize: 14, fontWeight: 500, fontFamily: '"Inter Tight", system-ui, sans-serif',
                    borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 120ms',
                  }}>
                    {submitting ? <><Loader2 size={14} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> Création…</> : <>Créer mon compte <IconArrow /></>}
                  </button>
                </form>

                <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(17,24,39,0.08)', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#8A93A1' }}>
                  {['Aucune carte bancaire requise', 'Hébergement en zone UEMOA (Abidjan)', 'Données conformes RGPD CEDEAO'].map(txt => (
                    <div key={txt} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#0E8F7E', display: 'flex' }}><IconCheck /></span>{txt}
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: '#5B6472' }}>
                  Vous avez déjà un compte ?{' '}
                  <a href="#" onClick={e => { e.preventDefault(); setTab('login'); setServerError(''); }} style={{ color: '#185FA5', textDecoration: 'none', fontWeight: 500 }}>Se connecter</a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <footer style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#8A93A1', paddingTop: 24 }}>
          <span>© 2026 Marabu Services · Abidjan, Côte d'Ivoire</span>
          <span style={{ display: 'flex', gap: 12 }}>
            {['Aide', 'Confidentialité', 'Conditions'].map(l => (
              <a key={l} href="#" onClick={e => e.preventDefault()} style={{ color: '#8A93A1', textDecoration: 'none' }}>{l}</a>
            ))}
          </span>
        </footer>
      </main>
    </div>
  );
}
