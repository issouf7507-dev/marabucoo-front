import { useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, TrendingUp, Banknote, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Chart, registerables, type ChartDataset } from 'chart.js';
import { fmt, MF, MK, ST_LABEL, ST_CLS, THIS_YEAR } from '../utils/format';
import { ROUTES } from '../router/routes';
import { useParams } from '../hooks/queries/useParams';
import { useCharges } from '../hooks/queries/useCharges';
import { useMissions } from '../hooks/queries/useMissions';
import { QueryCard } from '../components/ui/QueryState';

Chart.register(...registerables);

function getEnc(m: { encaissements: { mois: string; montant: number }[] }, k: string) {
  return m.encaissements.find(e => e.mois === k)?.montant ?? 0;
}
function getReel(c: { realisations: { mois: string; annee: number; montant: number }[] }, k: string) {
  return c.realisations.find(r => r.mois === k && r.annee === THIS_YEAR)?.montant ?? 0;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const fluxRef  = useRef<HTMLCanvasElement>(null);
  const catRef   = useRef<HTMLCanvasElement>(null);
  const fluxChart = useRef<Chart | null>(null);
  const catChart  = useRef<Chart | null>(null);

  const { data: params,  isLoading: lP, error: eP } = useParams();
  const { data: charges = [], isLoading: lC, error: eC } = useCharges();
  const { data: missions = [], isLoading: lM, error: eM } = useMissions();

  const isLoading = lP || lC || lM;
  const error     = eP || eC || eM;

  // ── Calculs ──────────────────────────────────────────────────
  const bq       = params?.banque           ?? 0;
  const cf       = params?.coffre           ?? 0;
  const frais    = params?.totalFraisTransf ?? 0;
  const penalite = params?.totalPenalite    ?? 0;
  const treso    = bq + cf;
  const chgMens  = useMemo(() => charges.reduce((s, c) => s + (c.budget || 0), 0), [charges]);
  const bfr      = treso - chgMens;
  const couv     = chgMens > 0 ? (treso / chgMens).toFixed(1) : '∞';
  const arrSolde = (params?.arrSal ?? 0) - (params?.arrSalR ?? 0);

  const activeMissions = useMemo(
    () => missions.filter(m => m.statut?.toUpperCase() === 'EN_COURS'),
    [missions]
  );
  const totalFacture  = useMemo(() => missions.reduce((s, m) => s + (m.montant || 0), 0), [missions]);
  const totalEncaisse = useMemo(() => missions.reduce((s, m) => s + (m.avance  || 0), 0), [missions]);
  const resteAEncaisser = totalFacture - totalEncaisse;

  const tvaTot = useMemo(
    () => missions.filter(m => m.tva === '18').reduce((s, m) => s + (m.avance || 0) * 18 / 118, 0),
    [missions]
  );

  const enAtt = useMemo(
    () => missions.filter(m => m.statut?.toUpperCase() === 'EN_COURS' && (m.avance || 0) < (m.montant || 0)),
    [missions]
  );

  // ── Données graphique flux ────────────────────────────────────
  const entreesMois = useMemo(
    () => MK.map(k => missions.reduce((s, m) => s + getEnc(m, k), 0)),
    [missions]
  );
  const chgReel = useMemo(
    () => MK.map(k => charges.reduce((s, c) => s + getReel(c, k), 0)),
    [charges]
  );

  // ── Données graphique donut ───────────────────────────────────
  const catD = useMemo(() => ({
    'Ressources humaines': charges.filter(c => c.categorie === 'RH').reduce((s, c) => s + (c.budget || 0), 0),
    'Exploitation':        charges.filter(c => c.categorie === 'EXPLOIT').reduce((s, c) => s + (c.budget || 0), 0),
    'Utilités':            charges.filter(c => c.categorie === 'UTIL').reduce((s, c) => s + (c.budget || 0), 0),
    'Variable':            charges.filter(c => c.categorie === 'VAR').reduce((s, c) => s + (c.budget || 0), 0),
  }), [charges]);

  // ── Alertes ──────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const list: { kind: 'r' | 'a' | 'g' | 'b'; icon: React.ReactNode; text: string }[] = [];
    if (arrSolde > 0)
      list.push({ kind: 'r', icon: <AlertTriangle size={13} />, text: `Arriéré salaires : ${fmt(arrSolde)} FCFA à apurer — mensualité ${fmt(params?.arrSalM ?? 0)} FCFA` });
    if (bfr < 0)
      list.push({ kind: 'r', icon: <AlertTriangle size={13} />, text: `BFR négatif : besoin de financement de ${fmt(-bfr)} FCFA` });
    if (enAtt.length)
      list.push({ kind: 'a', icon: <TrendingUp size={13} />, text: `${enAtt.length} mission(s) avec encaissements attendus : ${fmt(enAtt.reduce((s, m) => s + (m.montant - m.avance), 0))} FCFA` });
    list.push({ kind: 'g', icon: <CheckCircle2 size={13} />, text: `Tréso totale : ${fmt(treso)} FCFA — Couverture ${couv} mois de charges` });
    if (tvaTot > 0)
      list.push({ kind: 'b', icon: <Info size={13} />, text: `TVA estimée à reverser : ${fmt(tvaTot)} FCFA (18% sur missions assujetties)` });
    if (resteAEncaisser > 0)
      list.push({ kind: 'b', icon: <Banknote size={13} />, text: `Reste à encaisser toutes missions : ${fmt(resteAEncaisser)} FCFA` });
    return list;
  }, [arrSolde, bfr, enAtt, treso, couv, tvaTot, resteAEncaisser, params]);

  // ── Graphiques ────────────────────────────────────────────────
  useEffect(() => {
    fluxChart.current?.destroy();
    catChart.current?.destroy();

    const s    = getComputedStyle(document.documentElement);
    const cG   = s.getPropertyValue('--G').trim();
    const cR   = s.getPropertyValue('--R').trim();
    const cB   = s.getPropertyValue('--B').trim();
    const cP   = s.getPropertyValue('--P').trim();
    const cA   = s.getPropertyValue('--A').trim();
    const cBor = s.getPropertyValue('--bor').trim();
    const cTx3 = s.getPropertyValue('--tx3').trim();
    const cSur = s.getPropertyValue('--sur').trim();

    if (fluxRef.current) {
      fluxChart.current = new Chart(fluxRef.current, {
        type: 'bar',
        data: {
          labels: MF.map(m => m.substring(0, 3)),
          datasets: [
            {
              label: 'Entrées missions',
              data: entreesMois,
              backgroundColor: `${cG}55`, borderColor: cG, borderWidth: 1,
            } as ChartDataset<'bar'>,
            {
              label: 'Charges réalisées',
              data: chgReel,
              type: 'line', borderColor: cR, tension: 0.3,
              backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3,
            } as ChartDataset<'line'>,
          ] as never,
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, color: cTx3, padding: 8 } } },
          scales: {
            x: { ticks: { color: cTx3, font: { size: 10 } }, grid: { color: cBor } },
            y: {
              ticks: {
                callback: v => {
                  const n = Number(v);
                  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
                  if (Math.abs(n) >= 1_000)     return (n / 1_000).toLocaleString('fr-FR',     { maximumFractionDigits: 0 }) + ' k';
                  return n.toLocaleString('fr-FR');
                },
                color: cTx3, font: { size: 10 },
              },
              grid: { color: cBor },
              title: { display: true, text: 'FCFA', color: cTx3, font: { size: 9 } },
            },
          },
        },
      });
    }

    const catVals  = Object.values(catD);
    const catTotal = catVals.reduce((s, v) => s + v, 0);
    if (catRef.current && catTotal > 0) {
      catChart.current = new Chart(catRef.current, {
        type: 'doughnut',
        data: {
          labels: Object.keys(catD),
          datasets: [{
            data: catVals,
            backgroundColor: [`${cG}CC`, `${cB}CC`, `${cA}CC`, `${cP}CC`],
            borderWidth: 2, borderColor: cSur,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, color: cTx3, padding: 8 } } },
        },
      });
    }

    return () => { fluxChart.current?.destroy(); catChart.current?.destroy(); };
  }, [entreesMois, chgReel, catD]);

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── Rendu ─────────────────────────────────────────────────────
  return (
    <div className="pg">
      <div className="ph">
        <div className="ph-l">
          <h1>Tableau de bord</h1>
          <p style={{ textTransform: 'capitalize' }}>{today}</p>
        </div>
      </div>

      {isLoading && <QueryCard isLoading error={null} />}
      {error     && <QueryCard isLoading={false} error={error} />}

      {!isLoading && !error && (
        <>
          {/* KPIs */}
          <div className="kr">
            <div className="kpi g">
              <div className="kpi-l">Tréso banque</div>
              <div className="kpi-v">{fmt(bq)}</div>
              <div className="kpi-s">FCFA disponibles</div>
            </div>
            <div className="kpi">
              <div className="kpi-l">Coffre-fort</div>
              <div className="kpi-v">{fmt(cf)}</div>
              <div className="kpi-s">FCFA espèces</div>
            </div>
            <div className={`kpi ${bfr >= 0 ? 'g' : 'r'}`}>
              <div className="kpi-l">BFR net</div>
              <div className="kpi-v">{bfr >= 0 ? '+' : ''}{fmt(bfr)}</div>
              <div className="kpi-s">{bfr >= 0 ? `Couv. ${couv} mois` : 'Besoin financement'}</div>
            </div>
            <div className="kpi r">
              <div className="kpi-l">Charges mensuelles</div>
              <div className="kpi-v">{fmt(chgMens)}</div>
              <div className="kpi-s">FCFA budget/mois</div>
            </div>
            <div className="kpi b">
              <div className="kpi-l">Missions actives</div>
              <div className="kpi-v">{activeMissions.length}</div>
              <div className="kpi-s">sur {missions.length} au total</div>
            </div>
            <div className="kpi t">
              <div className="kpi-l">Reste à encaisser</div>
              <div className="kpi-v">{fmt(resteAEncaisser)}</div>
              <div className="kpi-s">toutes missions</div>
            </div>
            <div className={`kpi ${arrSolde > 0 ? 'a' : 'g'}`}>
              <div className="kpi-l">Arriéré salaires</div>
              <div className="kpi-v">{fmt(arrSolde)}</div>
              <div className="kpi-s">{arrSolde > 0 ? 'FCFA à apurer' : 'Apuré'}</div>
            </div>
            <div className="kpi r">
              <div className="kpi-l">TVA à reverser</div>
              <div className="kpi-v">{fmt(tvaTot)}</div>
              <div className="kpi-s">estimation 18%</div>
            </div>
            <div className="kpi a">
              <div className="kpi-l">Frais de transfert</div>
              <div className="kpi-v">{fmt(frais)}</div>
              <div className="kpi-s">FCFA cumulés</div>
            </div>
            <div className="kpi r">
              <div className="kpi-l">Pénalités</div>
              <div className="kpi-v">{fmt(penalite)}</div>
              <div className="kpi-s">FCFA cumulés</div>
            </div>
          </div>

          {/* Graphiques */}
          <div className="g2" style={{ marginBottom: 14 }}>
            <div className="card">
              <div className="ch"><h3>Flux mensuel {THIS_YEAR} — Entrées vs Charges réalisées</h3></div>
              <div className="cb"><div className="cw" style={{ height: 215 }}><canvas ref={fluxRef} /></div></div>
            </div>
            <div className="card">
              <div className="ch">
                <h3>Répartition charges budgétées</h3>
                <span style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>{fmt(chgMens)} FCFA/mois</span>
              </div>
              <div className="cb"><div className="cw" style={{ height: 215 }}><canvas ref={catRef} /></div></div>
            </div>
          </div>

          {/* Missions actives + Alertes */}
          <div className="g2">
            <div className="card">
              <div className="ch fb">
                <h3>Missions actives ({activeMissions.length})</h3>
                <button className="btn xs" onClick={() => navigate(ROUTES.MISSIONS)}>
                  Voir tout <ArrowRight size={12} strokeWidth={2} />
                </button>
              </div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Mission</th>
                      <th>Client</th>
                      <th className="tr">Montant HT</th>
                      <th className="tr">Encaissé</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeMissions.length === 0
                      ? <tr><td colSpan={5} className="empty">Aucune mission active</td></tr>
                      : activeMissions.map(m => {
                          const pct     = (m.montant || 0) > 0 ? Math.round((m.avance || 0) / m.montant * 100) : 0;
                          const statKey = m.statut?.toLowerCase() ?? '';
                          return (
                            <tr key={m.id}>
                              <td>
                                <div className="fw7" style={{ fontSize: 12 }}>{m.nom}</div>
                                {m.desc && <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{m.desc.substring(0, 48)}</div>}
                              </td>
                              <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{m.client}</td>
                              <td className="tnum">{fmt(m.montant)}</td>
                              <td className="tnum">
                                <span className="tc">{fmt(m.avance)}</span>
                                <span style={{ fontSize: 10, color: 'var(--tx3)', marginLeft: 4 }}>({pct}%)</span>
                                <div className="prog" style={{ marginTop: 3 }}>
                                  <div className="prog-b" style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                              </td>
                              <td><span className={`bdg ${ST_CLS[statKey] ?? 'bn'}`}>{ST_LABEL[statKey] ?? m.statut}</span></td>
                            </tr>
                          );
                        })
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="ch"><h3>Alertes & points de vigilance</h3></div>
              <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.map((a, i) => (
                  <div key={i} className={`alert ${a.kind}`} style={{ marginBottom: 0 }}>
                    <span style={{ flexShrink: 0, marginTop: 1 }}>{a.icon}</span>
                    <span style={{ fontSize: 12 }}>{a.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
