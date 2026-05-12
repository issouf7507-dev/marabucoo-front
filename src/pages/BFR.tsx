import { useRef, useEffect, useState, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import { fmt, MF, MK } from '../utils/format';
import { useParams } from '../hooks/queries/useParams';
import { useCharges } from '../hooks/queries/useCharges';
import { useMissions } from '../hooks/queries/useMissions';
import { QueryCard } from '../components/ui/QueryState';

Chart.register(...registerables);

// Retourne le montant d'encaissement d'une mission pour un mois donné
function getEnc(mission: { encaissements: { mois: string; montant: number }[] }, mois: string): number {
  return mission.encaissements.find(e => e.mois === mois)?.montant ?? 0;
}

export default function BFR() {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<Chart | null>(null);

  const { data: params, isLoading: lParams, error: eParams } = useParams();
  const { data: charges = [], isLoading: lCharges, error: eCharges } = useCharges();
  const { data: missions = [], isLoading: lMissions, error: eMissions } = useMissions();

  const isLoading = lParams || lCharges || lMissions;
  const error = eParams || eCharges || eMissions;

  // Valeurs initiales dérivées de l'API, surchargeables par l'utilisateur
  const defaultT0 = (params?.banque ?? 0) + (params?.coffre ?? 0);
  const defaultChgMens = useMemo(() => charges.reduce((s, c) => s + (c.budget || 0), 0), [charges]);

  const [t0, setT0] = useState(0);
  const [chgMens, setChgMens] = useState(0);
  const [rxCompl, setRxCompl] = useState(0);
  const [horizon, setHorizon] = useState(6);
  const [synced, setSynced] = useState(false);

  // Sync les valeurs dès que les données API arrivent (une seule fois)
  useEffect(() => {
    if (!synced && !isLoading && !error) {
      setT0(defaultT0);
      setChgMens(defaultChgMens);
      setSynced(true);
    }
  }, [synced, isLoading, error, defaultT0, defaultChgMens]);

  // Projection
  const projection = useMemo(() => {
    let treso = t0;
    return MF.slice(0, horizon).map((mois, i) => {
      const k = MK[i];
      const entrees = missions.reduce((s, m) => s + getEnc(m, k), 0) + rxCompl;
      const chg = chgMens;
      treso = treso + entrees - chg;
      return { mois, k, entrees, chg, tresoFin: treso, bfr: entrees - chg };
    });
  }, [t0, chgMens, rxCompl, horizon, missions]);

  const totalEntrees = projection.reduce((s, r) => s + r.entrees, 0);
  const moisPositifs = projection.filter(r => r.bfr >= 0).length;
  const tresoMin = Math.min(...projection.map(r => r.tresoFin));
  const moisTresoNeg = projection.filter(r => r.tresoFin < 0).length;

  // Graphique
  useEffect(() => {
    chartInst.current?.destroy();
    const style = getComputedStyle(document.documentElement);
    const cG = style.getPropertyValue('--G').trim();
    const cB = style.getPropertyValue('--B').trim();
    const cBor = style.getPropertyValue('--bor').trim();
    const cTx3 = style.getPropertyValue('--tx3').trim();
    // const cTx      = style.getPropertyValue('--tx').trim();

    if (chartRef.current) {
      chartInst.current = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels: projection.map(r => r.mois.substring(0, 3)),
          datasets: [
            {
              label: 'Tréso fin de mois',
              data: projection.map(r => r.tresoFin),
              borderColor: cG, backgroundColor: `${cG}14`,
              fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2,
            },
            {
              label: 'BFR mensuel',
              data: projection.map(r => r.bfr),
              borderColor: cB, backgroundColor: 'transparent',
              tension: 0.3, pointRadius: 3, borderWidth: 1.5,
              borderDash: [4, 4] as never,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { font: { size: 10 }, color: cTx3 } },
          },
          scales: {
            x: { ticks: { color: cTx3, font: { size: 10 } }, grid: { color: cBor } },
            y: { ticks: { callback: (v) => Math.round(Number(v) / 1000000) + 'M', color: cTx3, font: { size: 10 } }, grid: { color: cBor } },
          },
        },
      });
    }
    return () => { chartInst.current?.destroy(); };
  }, [projection]);

  if (isLoading) return (
    <div className="pg">
      <div className="ph"><div className="ph-l"><h1>BFR Prévisionnel</h1></div></div>
      <QueryCard isLoading error={null} />
    </div>
  );

  if (error) return (
    <div className="pg">
      <div className="ph"><div className="ph-l"><h1>BFR Prévisionnel</h1></div></div>
      <QueryCard isLoading={false} error={error} />
    </div>
  );

  return (
    <div className="pg">
      <div className="ph">
        <div className="ph-l">
          <h1>BFR Prévisionnel</h1>
          <p>Simulation trésorerie — encaissements planifiés + charges + projection</p>
        </div>
      </div>

      <div className="g2" style={{ marginBottom: 14 }}>
        {/* Paramètres */}
        <div className="card">
          <div className="ch"><h3>Paramètres de simulation</h3></div>
          <div className="cb">
            <div className="fg" style={{ gridTemplateColumns: '1fr' }}>
              <div className="fr">
                <label className="lbl">Trésorerie initiale (FCFA)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="inp" type="number" value={t0} onChange={e => setT0(+e.target.value)} style={{ flex: 1 }} />
                  {t0 !== defaultT0 && (
                    <button className="btn xs" onClick={() => setT0(defaultT0)} title="Remettre la valeur API">↺</button>
                  )}
                </div>
                <span style={{ fontSize: 10, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>
                  Banque {fmt(params?.banque)} + Coffre {fmt(params?.coffre)}
                </span>
              </div>
              <div className="fr">
                <label className="lbl">Charges fixes mensuelles (FCFA)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="inp" type="number" value={chgMens} onChange={e => setChgMens(+e.target.value)} style={{ flex: 1 }} />
                  {chgMens !== defaultChgMens && (
                    <button className="btn xs" onClick={() => setChgMens(defaultChgMens)} title="Remettre la valeur API">↺</button>
                  )}
                </div>
                <span style={{ fontSize: 10, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>
                  Calculé depuis {charges.length} postes de charge
                </span>
              </div>
              <div className="fr">
                <label className="lbl">Revenus complémentaires (FCFA/mois)</label>
                <input className="inp" type="number" value={rxCompl} onChange={e => setRxCompl(+e.target.value)} />
              </div>
              <div className="fr">
                <label className="lbl">Horizon de projection</label>
                <select className="sel" value={horizon} onChange={e => setHorizon(+e.target.value)}>
                  <option value={3}>3 mois</option>
                  <option value={6}>6 mois</option>
                  <option value={9}>9 mois</option>
                  <option value={12}>12 mois</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Indicateurs */}
        <div className="card">
          <div className="ch"><h3>Indicateurs clés</h3></div>
          <div className="cb">
            <div className="kr" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="kpi g">
                <div className="kpi-l">Tréso initiale</div>
                <div className="kpi-v">{fmt(t0)}</div>
                <div className="kpi-s">FCFA</div>
              </div>
              <div className={`kpi ${tresoMin >= 0 ? 'g' : 'r'}`}>
                <div className="kpi-l">Tréso minimum</div>
                <div className="kpi-v">{fmt(tresoMin)}</div>
                <div className="kpi-s">{tresoMin < 0 ? '⚠ Déficit' : 'OK'}</div>
              </div>
              <div className="kpi b">
                <div className="kpi-l">Mois positifs</div>
                <div className="kpi-v">{moisPositifs}/{horizon}</div>
                <div className="kpi-s">BFR ≥ 0</div>
              </div>
              <div className={`kpi ${moisTresoNeg > 0 ? 'r' : 'g'}`}>
                <div className="kpi-l">Mois déficitaires</div>
                <div className="kpi-v">{moisTresoNeg}</div>
                <div className="kpi-s">tréso négative</div>
              </div>
              <div className="kpi g">
                <div className="kpi-l">Total entrées</div>
                <div className="kpi-v">{fmt(totalEntrees)}</div>
                <div className="kpi-s">FCFA planifiés</div>
              </div>
              <div className="kpi a">
                <div className="kpi-l">Total charges</div>
                <div className="kpi-v">{fmt(chgMens * horizon)}</div>
                <div className="kpi-s">sur {horizon} mois</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau encaissements missions */}
      {missions.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="ch">
            <h3>Encaissements missions planifiés</h3>
            <span style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: 'var(--fm)' }}>{missions.length} mission{missions.length > 1 ? 's' : ''}</span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Mission</th>
                  <th>Client</th>
                  <th className="tr">Total prévu</th>
                  {MK.slice(0, horizon).map((k, i) => (
                    <th key={k} className="tr">{MF[i].substring(0, 3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {missions.map(m => {
                  const total = MK.reduce((s, k) => s + getEnc(m, k), 0);
                  return (
                    <tr key={m.id}>
                      <td className="fw7" style={{ fontSize: 12 }}>{m.nom}</td>
                      <td style={{ fontSize: 11, color: 'var(--tx3)' }}>{m.client}</td>
                      <td className="tnum tc">{total > 0 ? fmt(total) : '—'}</td>
                      {MK.slice(0, horizon).map(k => {
                        const v = getEnc(m, k);
                        return (
                          <td key={k} className="tnum" style={{ fontSize: 11 }}>
                            {v > 0 ? <span style={{ color: 'var(--G)' }}>{fmt(v)}</span> : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr style={{ background: 'var(--sur2)', borderTop: '1px solid var(--bor2)' }}>
                  <td colSpan={3} className="fw7" style={{ fontSize: 11, color: 'var(--tx3)', padding: '6px 10px' }}>Total encaissements</td>
                  {MK.slice(0, horizon).map((k) => {
                    const tot = missions.reduce((s, m) => s + getEnc(m, k), 0) + rxCompl;
                    return (
                      <td key={k} className="tnum fw7" style={{ fontSize: 11, color: tot > 0 ? 'var(--G)' : 'var(--tx3)' }}>
                        {tot > 0 ? fmt(tot) : '—'}
                      </td>
                    );
                  }

                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Graphique */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch"><h3>Projection mensuelle — Trésorerie & BFR</h3></div>
        <div className="cb"><div className="cw" style={{ height: 240 }}><canvas ref={chartRef} /></div></div>
      </div>

      {/* Tableau de projection */}
      <div className="card">
        <div className="ch"><h3>Tableau de projection détaillé</h3></div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Mois</th>
                <th className="tr">Tréso début</th>
                <th className="tr">Entrées</th>
                <th className="tr">Charges</th>
                <th className="tr">Tréso fin</th>
                <th className="tr">BFR</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {projection.map((r, i) => {
                const tresoDebut = i === 0 ? t0 : projection[i - 1].tresoFin;
                return (
                  <tr key={r.mois} style={r.tresoFin < 0 ? { background: 'rgba(255,77,77,.04)' } : undefined}>
                    <td className="fw7">{r.mois}</td>
                    <td className="tnum" style={{ color: 'var(--tx2)' }}>{fmt(tresoDebut)}</td>
                    <td className="tnum tc">{r.entrees > 0 ? fmt(r.entrees) : '—'}</td>
                    <td className="tnum ac">{fmt(r.chg)}</td>
                    <td className={`tnum fw7 ${r.tresoFin >= 0 ? 'tc' : 'rc'}`}>{fmt(r.tresoFin)}</td>
                    <td className={`tnum ${r.bfr >= 0 ? 'tc' : 'rc'}`}>{fmt(r.bfr)}</td>
                    <td>
                      <span className={`bdg ${r.tresoFin >= 0 ? 'bg' : 'br'}`}>
                        {r.tresoFin >= 0 ? 'OK' : 'Déficit'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--bor2)' }}>
                <td className="fw7" style={{ padding: '7px 10px', fontSize: 12 }}>TOTAL</td>
                <td></td>
                <td className="tnum fw7 tc">{fmt(totalEntrees)}</td>
                <td className="tnum fw7 ac">{fmt(chgMens * horizon)}</td>
                <td className={`tnum fw7 ${projection[projection.length - 1]?.tresoFin >= 0 ? 'tc' : 'rc'}`}>
                  {fmt(projection[projection.length - 1]?.tresoFin)}
                </td>
                <td></td><td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
