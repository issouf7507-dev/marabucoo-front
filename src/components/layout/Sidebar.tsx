import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Kanban, FileText, TrendingUp,
  Users, Layers, Landmark, Wallet,
  BarChart3, Calculator, Percent, Settings, LogOut, Sun, Moon, FileCheck2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { initials } from '../../utils/format';
import { ROUTES } from '../../router/routes';

interface NavItem { to: string; label: string; Icon: LucideIcon }

const allSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Vue globale',
    items: [{ to: ROUTES.DASHBOARD, label: 'Tableau de bord', Icon: LayoutDashboard }],
  },
  {
    title: 'Pipeline commercial',
    items: [
      { to: ROUTES.MISSIONS, label: 'Missions & Pipeline', Icon: Kanban },
      { to: ROUTES.FACTURATION, label: 'Facturation', Icon: FileText },
      { to: ROUTES.FNE, label: 'FNE – DGI', Icon: FileCheck2 },
      { to: ROUTES.ENCAISSEMENTS, label: 'Encaissements', Icon: TrendingUp },
    ],
  },
  {
    title: 'Charges & Dépenses',
    items: [
      { to: ROUTES.SALAIRES, label: 'Détail salaires', Icon: Users },
      { to: ROUTES.CHARGES, label: 'Charges fixes', Icon: Layers },
      { to: ROUTES.DEPENSES, label: 'Dépenses banque', Icon: Landmark },
      { to: ROUTES.PETITE_CAISSE, label: 'Petite caisse', Icon: Wallet },
    ],
  },
  {
    title: 'Analyse financière',
    items: [
      { to: ROUTES.TRESORERIE, label: 'Trésorerie', Icon: BarChart3 },
      { to: ROUTES.BFR, label: 'BFR Prévisionnel', Icon: Calculator },
      { to: ROUTES.TVA, label: 'TVA estimative', Icon: Percent },
    ],
  },
  {
    title: 'Configuration',
    items: [{ to: ROUTES.PARAMETRES, label: 'Paramètres', Icon: Settings }],
  },
];

const ASSISTANTE_ROUTES = new Set([ROUTES.DASHBOARD, ROUTES.PETITE_CAISSE]);

function getSections(role: string) {
  if (role !== 'ASSISTANTE') return allSections;
  return allSections
    .map(s => ({ ...s, items: s.items.filter(i => ASSISTANTE_ROUTES.has(i.to)) }))
    .filter(s => s.items.length > 0);
}

interface SidebarProps {
  user: { name: string; email: string; role: string };
  onLogout: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function Sidebar({ user, onLogout, theme, onToggleTheme }: SidebarProps) {
  const sections = getSections(user.role);
  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="sb-logo">Marabu</div>
        <div className="sb-sub">Tableau de bord COO</div>
      </div>

      <nav className="sb-nav">
        {sections.map(s => (
          <div key={s.title}>
            <div className="sb-sep">{s.title}</div>
            {s.items.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `sb-a${isActive ? ' on' : ''}`}
                style={{
                  textDecoration: 'none'
                }}
              >
                <span className="sb-ic "><Icon size={14} strokeWidth={1.8} /></span>
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: '10px 14px 12px', borderTop: '1px solid var(--bor)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(0,196,98,.12)', color: 'var(--G)',
            fontSize: 10, fontWeight: 700, fontFamily: 'var(--fm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {initials(user.name)}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name}
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--fm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.role}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            style={{
              flex: 1, background: 'var(--sur2)', border: '1px solid var(--bor2)',
              borderRadius: 'var(--r)', padding: '5px 0', fontSize: 11, color: 'var(--tx3)',
              cursor: 'pointer', fontFamily: 'var(--ff)', transition: '.12s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
            onMouseEnter={e => { (e.currentTarget.style.background = 'var(--sur3)'); (e.currentTarget.style.color = 'var(--tx)'); }}
            onMouseLeave={e => { (e.currentTarget.style.background = 'var(--sur2)'); (e.currentTarget.style.color = 'var(--tx3)'); }}
          >
            {theme === 'dark'
              ? <><Sun size={12} strokeWidth={2} />Clair</>
              : <><Moon size={12} strokeWidth={2} />Sombre</>
            }
          </button>
          <button
            onClick={onLogout}
            title="Déconnexion"
            style={{
              flex: 1, background: 'var(--sur2)', border: '1px solid var(--bor2)',
              borderRadius: 'var(--r)', padding: '5px 0', fontSize: 11, color: 'var(--tx3)',
              cursor: 'pointer', fontFamily: 'var(--ff)', transition: '.12s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
            onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,77,77,.1)'); (e.currentTarget.style.color = 'var(--R)'); }}
            onMouseLeave={e => { (e.currentTarget.style.background = 'var(--sur2)'); (e.currentTarget.style.color = 'var(--tx3)'); }}
          >
            <LogOut size={12} strokeWidth={2} />
            Sortir
          </button>
        </div>
      </div>
    </aside>
  );
}
