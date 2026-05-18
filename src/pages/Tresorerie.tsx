import { useRef, useEffect, useState, useMemo } from 'react';
import { Pencil } from 'lucide-react';
import { Chart, registerables, type ChartDataset } from 'chart.js';
import { fmt, MF, THIS_YEAR } from '../utils/format';
import YearSelect from '../components/ui/YearSelect';
import Modal from '../components/ui/Modal';
import Field from '../components/ui/Field';
import { QueryRows, QueryCard } from '../components/ui/QueryState';
import { useTresorerie, useUpsertTresorerie } from '../hooks/queries/useTresorerie';
import { useParams } from '../hooks/queries/useParams';
import type { ApiTresorerie } from '../services/tresorerie.service';

Chart.register(...registerables);

const EMPTY: ApiTresorerie = {
  id: 0, mois: '', annee: THIS_YEAR, type: 'prevision',
  banque: 0, coffre: 0, entrees: 0, chgPrev: 0, chgPay: 0, reste: 0,
};

export default function Tresorerie() {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chart2Ref = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<Chart | null>(null);
  const chart2Inst = useRef<Chart | null>(null);

  const [annee, setAnnee] = useState(THIS_YEAR);
  const [editTarget, setEditTarget] = useState<ApiTresorerie | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // form state
  const [fType, setFType] = useState('prevision');
  const [fBanque, setFBanque] = useState(0);
  const [fCoffre, setFCoffre] = useState(0);
  const [fEntrees, setFEntrees] = useState(0);
  const [fPrev, setFPrev] = useState(0);
  const [fReste, setFReste] = useState(0);

  const { data: rows = [], isLoading, error } = useTresorerie(annee);
  const { data: params } = useParams();
  const upsertMutation = useUpsertTresorerie();

  // Merge API rows with MF (12 mois) — mémoïsé pour éviter de recréer les graphiques à chaque render
  const grid = useMemo(() => {
    const moisMap = new Map(rows.map(r => [r.mois, r]));
    return MF.map(m => moisMap.get(m) ?? { ...EMPTY, mois: m, annee });
  }, [rows, annee]);

  const totalEntrees = grid.reduce((s, r) => s + r.entrees, 0);
  const totalChgPrev = grid.reduce((s, r) => s + r.chgPrev, 0);
  const totalChgPay = grid.reduce((s, r) => s + r.chgPay, 0);

  // Charts
  useEffect(() => {
    chartInst.current?.destroy();
    chart2Inst.current?.destroy();

    const labels = grid.map(r => r.mois.substring(0, 3));

    if (chartRef.current) {
      chartInst.current = new Chart(chartRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Entrées missions', data: grid.map(r => r.entrees), backgroundColor: 'rgba(27,94,64,.55)', borderColor: '#1B5E40', borderWidth: 1 } as ChartDataset<'bar'>,
            { label: 'Charges prévues', data: grid.map(r => r.chgPrev), backgroundColor: 'rgba(181,98,10,.3)', borderColor: '#B5620A', borderWidth: 1 } as ChartDataset<'bar'>,
            { label: 'Charges payées', data: grid.map(r => r.chgPay), type: 'line', borderColor: '#B53A2A', tension: 0.3, backgroundColor: 'transparent', borderWidth: 2 } as ChartDataset<'line'>,
          ] as never,
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
          scales: { y: { ticks: { callback: (v) => Math.round(Number(v) / 1000000) + 'M', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,.04)' } } },
        },
      });
    }

    let cumul = 0;
    const cumulData = grid.map(r => { cumul += r.entrees - r.chgPrev; return cumul; });

    if (chart2Ref.current) {
      chart2Inst.current = new Chart(chart2Ref.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Tréso cumulée', data: cumulData, borderColor: '#1B5E40', backgroundColor: 'rgba(27,94,64,.08)', fill: true, tension: 0.3, pointRadius: 4 },
            { label: 'BFR mensuel', data: grid.map(r => r.entrees - r.chgPrev), borderColor: '#1A4E8A', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, borderDash: [4, 4] },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
          scales: { y: { ticks: { callback: (v) => Math.round(Number(v) / 1000000) + 'M', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,.04)' } } },
        },
      });
    }

    return () => { chartInst.current?.destroy(); chart2Inst.current?.destroy(); };
  }, [grid]);

  function openEdit(r: ApiTresorerie) {
    setSaveError(null);
    setFType(r.type);
    setFBanque(r.banque);
    setFCoffre(r.coffre);
    setFEntrees(r.entrees);
    setFPrev(r.chgPrev);
    setFReste(r.reste);
    setEditTarget(r);
  }

  async function save() {
    if (!editTarget) return;
    setSaveError(null);
    try {
      await upsertMutation.mutateAsync({
        mois: editTarget.mois,
        annee,
        data: { type: fType, banque: fBanque, coffre: fCoffre, entrees: fEntrees, chgPrev: fPrev, reste: fReste },
      });
      setEditTarget(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur lors de l\'enregistrement');
    }
  }

  return (
    <div className="pg">
      <div className="ph">
        <div className="ph-l">
          <h1>Trésorerie mensuelle</h1>
          <p>Réel + Prévision — Entrées vs Charges</p>
        </div>
        <div className="ph-r">
          <YearSelect value={annee} onChange={setAnnee} />
        </div>
      </div>

      <div className="kr">
        <div className="kpi g">
          <div className="kpi-l">Solde banque</div>
          <div className="kpi-v">{fmt(params?.banque ?? 0)}</div>
          <div className="kpi-s">FCFA disponibles</div>
        </div>
        <div className="kpi">
          <div className="kpi-l">Coffre-fort</div>
          <div className="kpi-v">{fmt(params?.coffre ?? 0)}</div>
          <div className="kpi-s">FCFA espèces</div>
        </div>
        <div className="kpi g">
          <div className="kpi-l">Total entrées missions</div>
          <div className="kpi-v">{fmt(totalEntrees)}</div>
          <div className="kpi-s">FCFA annuel</div>
        </div>
        <div className="kpi a">
          <div className="kpi-l">Charges prévues annuel</div>
          <div className="kpi-v">{fmt(totalChgPrev)}</div>
          <div className="kpi-s">FCFA budget</div>
        </div>
        <div className="kpi r">
          <div className="kpi-l">Charges payées annuel</div>
          <div className="kpi-v">{fmt(totalChgPay)}</div>
          <div className="kpi-s">FCFA réel</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch"><h3>Flux mensuel {annee} — Entrées missions vs Charges</h3></div>
        {isLoading || error
          ? <div className="cb"><QueryCard isLoading={isLoading} error={error} /></div>
          : <div className="cb"><div className="cw" style={{ height: 240 }}><canvas ref={chartRef} /></div></div>
        }
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch fb"><h3>Tableau mensuel {annee}</h3></div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Mois</th><th>Type</th><th>Solde banque</th><th>Solde coffre</th>
                <th>Entrées missions</th><th>Charges prévues</th><th>Charges payées</th>
                <th>Reste à payer</th><th>BFR estimé</th><th></th>
              </tr>
            </thead>
            <tbody>
              <QueryRows isLoading={isLoading} error={error} colSpan={10} />
              {!isLoading && !error && grid.map((r) => (
                <tr key={r.mois}>
                  <td className="fw7">{r.mois}</td>
                  <td>
                    <span className={`bdg ${r.type === 'reel' ? 'bg' : 'bb'}`}>
                      {r.type === 'reel' ? 'Réel' : 'Prévision'}
                    </span>
                  </td>
                  <td className="tnum">{r.banque > 0 ? fmt(r.banque) : '—'}</td>
                  <td className="tnum">{r.coffre > 0 ? fmt(r.coffre) : '—'}</td>
                  <td className="tnum tc">{r.entrees > 0 ? fmt(r.entrees) : '—'}</td>
                  <td className="tnum ac">{r.chgPrev > 0 ? fmt(r.chgPrev) : '—'}</td>
                  <td className="tnum rc">{r.chgPay > 0 ? fmt(r.chgPay) : '—'}</td>
                  <td className="tnum">{r.reste > 0 ? fmt(r.reste) : '—'}</td>
                  <td className={`tnum fw7 ${r.entrees - r.chgPrev >= 0 ? 'tc' : 'rc'}`}>
                    {r.entrees || r.chgPrev ? fmt(r.entrees - r.chgPrev) : '—'}
                  </td>
                  <td>
                    <button className="ibt" title="Modifier" onClick={() => openEdit(r)}>
                      <Pencil size={13} strokeWidth={2} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--sur2)', borderTop: '2px solid var(--bor2)' }}>
                <td colSpan={4} className="fw7" style={{ padding: '7px 10px', fontSize: 12 }}>TOTAL</td>
                <td className="tnum fw7 tc">{fmt(totalEntrees)}</td>
                <td className="tnum fw7 ac">{fmt(totalChgPrev)}</td>
                <td className="tnum fw7 rc">{fmt(totalChgPay)}</td>
                <td></td><td></td><td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="ch"><h3>Trésorerie cumulée & Besoin de financement mensuel</h3></div>
        {isLoading || error
          ? <div className="cb"><QueryCard isLoading={isLoading} error={error} /></div>
          : <div className="cb"><div className="cw" style={{ height: 210 }}><canvas ref={chart2Ref} /></div></div>
        }
      </div>

      <Modal
        open={!!editTarget}
        title={`Saisir — ${editTarget?.mois ?? ''} ${annee}`}
        onClose={() => setEditTarget(null)}
        onSave={save}
        saving={upsertMutation.isPending}
        saveLabel={upsertMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        width={520}
      >
        {editTarget && (
          <div className="fg">
            <Field as="select" label="Type" value={fType} onChange={e => setFType(e.target.value)}>
              <option value="prevision">Prévision</option>
              <option value="reel">Réel</option>
            </Field>
            <Field label="Entrées missions (FCFA)" type="number" value={fEntrees}
              onChange={e => setFEntrees(+e.target.value)} />
            <Field label="Charges prévues (FCFA)" type="number" value={fPrev}
              onChange={e => setFPrev(+e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--tx3)', padding: '4px 0', gridColumn: '1/-1' }}>
              ℹ️ Les charges payées sont calculées automatiquement depuis les salaires et charges réalisées.
            </div>
            <Field label="Reste à payer (FCFA)" type="number" value={fReste}
              onChange={e => setFReste(+e.target.value)} />
            <Field label="Solde banque (FCFA)" type="number" value={fBanque}
              onChange={e => setFBanque(+e.target.value)} />
            <Field label="Solde coffre (FCFA)" type="number" value={fCoffre}
              onChange={e => setFCoffre(+e.target.value)} />
            {saveError && (
              <div className="alert r" style={{ marginTop: 4 }}>{saveError}</div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
