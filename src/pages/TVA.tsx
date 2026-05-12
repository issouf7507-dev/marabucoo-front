import { AlertTriangle } from 'lucide-react';
import { fmt, MF, MK } from '../utils/format';
import { useMissions } from '../hooks/queries/useMissions';
import { QueryCard } from '../components/ui/QueryState';
import { ST_LABEL, ST_CLS } from '../utils/format';

function getEnc(m: { encaissements: { mois: string; montant: number }[] }, k: string): number {
  return m.encaissements.find(e => e.mois === k)?.montant ?? 0;
}

export default function TVA() {
  const { data: missions = [], isLoading, error } = useMissions();

  const assujettis = missions.filter(m => m.tva === '18');
  const exoneres   = missions.filter(m => m.tva !== '18');

  // KPIs globaux — basé sur avance TTC encaissée
  const totalTTC = assujettis.reduce((s, m) => s + (m.avance || 0), 0);
  const totalHT  = Math.round(totalTTC * 100 / 118);
  const totalTVA = totalTTC - totalHT;

  // Récap mensuel — encaissements TTC par mois
  const moisTVA = MF.map((mois, i) => {
    const k   = MK[i];
    const ttc = assujettis.reduce((s, m) => s + getEnc(m, k), 0);
    const tva = Math.round(ttc * 18 / 118);
    return { mois, ttc, tva };
  }).filter(r => r.ttc > 0);

  if (isLoading) return (
    <div className="pg">
      <div className="ph"><div className="ph-l"><h1>TVA estimative</h1></div></div>
      <QueryCard isLoading error={null} />
    </div>
  );

  if (error) return (
    <div className="pg">
      <div className="ph"><div className="ph-l"><h1>TVA estimative</h1></div></div>
      <QueryCard isLoading={false} error={error} />
    </div>
  );

  return (
    <div className="pg">
      <div className="ph">
        <div className="ph-l">
          <h1>TVA estimative</h1>
          <p>TVA collectée sur missions assujetties — à titre indicatif</p>
        </div>
      </div>

      <div className="kr">
        <div className="kpi b">
          <div className="kpi-l">Missions assujetties</div>
          <div className="kpi-v">{assujettis.length}</div>
          <div className="kpi-s">taux 18%</div>
        </div>
        <div className="kpi g">
          <div className="kpi-l">Missions exonérées</div>
          <div className="kpi-v">{exoneres.length}</div>
          <div className="kpi-s">non assujetties</div>
        </div>
        <div className="kpi">
          <div className="kpi-l">Total TTC encaissé</div>
          <div className="kpi-v">{fmt(totalTTC)}</div>
          <div className="kpi-s">FCFA (avances)</div>
        </div>
        <div className="kpi">
          <div className="kpi-l">HT estimé</div>
          <div className="kpi-v">{fmt(totalHT)}</div>
          <div className="kpi-s">FCFA hors taxe</div>
        </div>
        <div className="kpi r">
          <div className="kpi-l">TVA à reverser</div>
          <div className="kpi-v">{fmt(totalTVA)}</div>
          <div className="kpi-s">FCFA (taux 18%)</div>
        </div>
      </div>

      <div className="g2" style={{ marginBottom: 14 }}>
        {/* TVA par mission */}
        <div className="card">
          <div className="ch">
            <h3>TVA collectée par mission (18%)</h3>
            <span className="bdg bb">{assujettis.length} assujettie{assujettis.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Mission</th>
                  <th>Client</th>
                  <th className="tr">Avance TTC</th>
                  <th className="tr">HT estimé</th>
                  <th className="tr">TVA 18%</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {assujettis.length === 0
                  ? <tr><td colSpan={6} className="empty">Aucune mission assujettie</td></tr>
                  : assujettis.map(m => {
                      const ht  = Math.round((m.avance || 0) * 100 / 118);
                      const tva = (m.avance || 0) - ht;
                      const statKey = m.statut?.toLowerCase() ?? '';
                      return (
                        <tr key={m.id}>
                          <td className="fw7" style={{ fontSize: 12 }}>{m.nom}</td>
                          <td style={{ color: 'var(--tx3)', fontSize: 11 }}>{m.client}</td>
                          <td className="tnum">{fmt(m.avance)}</td>
                          <td className="tnum" style={{ color: 'var(--tx2)' }}>{fmt(ht)}</td>
                          <td className="tnum rc fw7">{fmt(tva)}</td>
                          <td>
                            <span className={`bdg ${ST_CLS[statKey] ?? 'bn'}`}>
                              {ST_LABEL[statKey] ?? m.statut}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
              {assujettis.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--bor2)' }}>
                    <td colSpan={2} className="fw7" style={{ padding: '7px 10px', fontSize: 12 }}>TOTAL</td>
                    <td className="tnum fw7">{fmt(totalTTC)}</td>
                    <td className="tnum fw7" style={{ color: 'var(--tx2)' }}>{fmt(totalHT)}</td>
                    <td className="tnum fw7 rc">{fmt(totalTVA)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Récap mensuel */}
        <div className="card">
          <div className="ch">
            <h3>Récapitulatif mensuel TVA</h3>
            <span className="bdg ba">{moisTVA.length} mois avec flux</span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Mois</th>
                  <th className="tr">Entrées TTC</th>
                  <th className="tr">HT</th>
                  <th className="tr">TVA 18%</th>
                  <th>Déclaration</th>
                </tr>
              </thead>
              <tbody>
                {moisTVA.length === 0
                  ? <tr><td colSpan={5} className="empty">Aucune entrée TVA planifiée</td></tr>
                  : moisTVA.map(r => {
                      const ht = r.ttc - r.tva;
                      return (
                        <tr key={r.mois}>
                          <td className="fw7">{r.mois}</td>
                          <td className="tnum">{fmt(r.ttc)}</td>
                          <td className="tnum" style={{ color: 'var(--tx2)' }}>{fmt(ht)}</td>
                          <td className="tnum rc fw7">{fmt(r.tva)}</td>
                          <td><span className="bdg ba">À déclarer</span></td>
                        </tr>
                      );
                    })
                }
              </tbody>
              {moisTVA.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--bor2)' }}>
                    <td className="fw7" style={{ padding: '7px 10px', fontSize: 12 }}>TOTAL</td>
                    <td className="tnum fw7">{fmt(moisTVA.reduce((s, r) => s + r.ttc, 0))}</td>
                    <td className="tnum fw7" style={{ color: 'var(--tx2)' }}>
                      {fmt(moisTVA.reduce((s, r) => s + (r.ttc - r.tva), 0))}
                    </td>
                    <td className="tnum fw7 rc">
                      {fmt(moisTVA.reduce((s, r) => s + r.tva, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Missions exonérées */}
      {exoneres.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="ch">
            <h3>Missions exonérées de TVA</h3>
            <span className="bdg bg">{exoneres.length} mission{exoneres.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Mission</th>
                  <th>Client</th>
                  <th className="tr">Montant</th>
                  <th className="tr">Avance</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {exoneres.map(m => {
                  const statKey = m.statut?.toLowerCase() ?? '';
                  return (
                    <tr key={m.id}>
                      <td className="fw7" style={{ fontSize: 12 }}>{m.nom}</td>
                      <td style={{ color: 'var(--tx3)', fontSize: 11 }}>{m.client}</td>
                      <td className="tnum">{fmt(m.montant)}</td>
                      <td className="tnum tc">{m.avance > 0 ? fmt(m.avance) : '—'}</td>
                      <td>
                        <span className={`bdg ${ST_CLS[statKey] ?? 'bn'}`}>
                          {ST_LABEL[statKey] ?? m.statut}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Avertissement légal */}
      <div className="card">
        <div className="cb">
          <div className="alert a">
            <AlertTriangle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              <strong>Important :</strong> Ces estimations sont indicatives uniquement. La TVA effective dépend de votre régime fiscal (réel ou simplifié), des encaissements constatés et des achats déductibles. Rapprochez-vous de votre expert-comptable pour les déclarations officielles auprès de la DGI Côte d'Ivoire.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
