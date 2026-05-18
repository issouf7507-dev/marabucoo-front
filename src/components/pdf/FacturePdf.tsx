import {
  Document, Page, Text, View, StyleSheet, pdf,
} from '@react-pdf/renderer';
import type { ApiFacture } from '../../services/factures.service';

// ── Couleurs & constantes ────────────────────────────────────────────
const GREEN  = '#1B5E40';
const DARK   = '#18181b';
const GRAY   = '#71717a';
const LIGHT  = '#f4f4f5';
const BORDER = '#e4e4e8';
const WHITE  = '#ffffff';

const fmtN = (n: number) =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ── Styles ───────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK,
    backgroundColor: WHITE,
    paddingTop: 72,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },

  // ── En-tête fixe ──────────────────────────────────────────────────
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: GREEN,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  hCompany: { color: WHITE, fontSize: 16, fontFamily: 'Helvetica-Bold' },
  hSub:     { color: 'rgba(255,255,255,0.72)', fontSize: 8, marginTop: 2 },
  hDocType: { color: WHITE, fontSize: 20, fontFamily: 'Helvetica-Bold' },
  hDocNum:  { color: 'rgba(255,255,255,0.9)', fontSize: 10, marginTop: 3, textAlign: 'right' },
  hDocDate: { color: 'rgba(255,255,255,0.65)', fontSize: 8, marginTop: 2, textAlign: 'right' },

  // ── Pied de page fixe ─────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  fText:  { color: GRAY, fontSize: 7.5 },
  fRight: { color: GRAY, fontSize: 7.5, textAlign: 'right' },

  // ── Sections ──────────────────────────────────────────────────────
  secTitle: {
    fontSize: 8, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 1,
    color: '#a1a1aa', marginBottom: 8,
  },

  // Parties (émetteur / client)
  partiesRow: { flexDirection: 'row', marginBottom: 22 },
  partyBox: {
    flex: 1,
    backgroundColor: LIGHT,
    borderRadius: 4,
    padding: 12,
  },
  partyBoxRight: { flex: 1, backgroundColor: LIGHT, borderRadius: 4, padding: 12, marginLeft: 16 },
  partyName: { fontFamily: 'Helvetica-Bold', fontSize: 13 },
  partyInfo: { color: GRAY, fontSize: 9.5, marginTop: 3 },

  // Tableau prestations
  tblHead: { flexDirection: 'row', backgroundColor: DARK, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 2 },
  tblHCell: { color: WHITE, fontSize: 8.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  tblRow: {
    flexDirection: 'row',
    paddingHorizontal: 10, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: BORDER, borderBottomStyle: 'solid',
  },
  tblCell: { fontSize: 10 },
  tblSub:  { fontSize: 8.5, color: GRAY, marginTop: 2 },

  // Totaux
  totalsWrap: { alignItems: 'flex-end', marginBottom: 22 },
  totalsBox: { width: 256 },
  totRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: BORDER, borderBottomStyle: 'solid',
  },
  totLbl: { fontSize: 10, color: GRAY },
  totVal: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  totGrandRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  totGrandLbl: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  totGrandVal: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: GREEN },
  totEncRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totEncLbl: { fontSize: 10, color: GRAY },
  totEncVal: { fontSize: 10, color: '#009950', fontFamily: 'Helvetica-Bold' },
  totSoldeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totSoldeLbl: { fontSize: 10, color: '#dc2626' },
  totSoldeVal: { fontSize: 10, color: '#dc2626', fontFamily: 'Helvetica-Bold' },

  // Échéancier
  echTitle: {
    fontSize: 8, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 1,
    color: '#a1a1aa', marginBottom: 8, marginTop: 4,
  },
  echHead: {
    flexDirection: 'row',
    backgroundColor: LIGHT,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  echHCell: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: GRAY },
  echRow: {
    flexDirection: 'row',
    paddingHorizontal: 10, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: BORDER, borderBottomStyle: 'solid',
  },
  echCell: { fontSize: 10 },
  echBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 3, fontSize: 8.5, fontFamily: 'Helvetica-Bold',
  },

  // Mentions légales
  legal: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1, borderTopColor: BORDER, borderTopStyle: 'solid',
  },
  legalText: { color: GRAY, fontSize: 8.5, marginBottom: 4, lineHeight: 1.5 },
  legalCenter: { color: GRAY, fontSize: 9, textAlign: 'center', marginTop: 12, fontFamily: 'Helvetica-Oblique' },
});

// ── Document PDF ─────────────────────────────────────────────────────
function FacturePdfDoc({ f }: { f: ApiFacture }) {
  const tvaMontant = f.tvaMontant ?? 0;
  const totalEnc   = f.tranches.reduce((s, t) => s + t.encaisse, 0);
  const solde      = f.ttc - totalEnc;

  return (
    <Document
      title={`Facture ${f.num}`}
      author="Marabu Services"
      subject={`Facture — ${f.mission.client}`}
      creator="Marabu Services"
    >
      <Page size="A4" style={S.page}>

        {/* ── En-tête fixe ── */}
        <View fixed style={S.header}>
          <View>
            <Text style={S.hCompany}>MARABU SERVICES</Text>
            <Text style={S.hSub}>Cabinet de conseil en management</Text>
            <Text style={S.hSub}>Abidjan, Côte d'Ivoire</Text>
          </View>
          <View>
            <Text style={S.hDocType}>FACTURE</Text>
            <Text style={S.hDocNum}>{f.num}</Text>
            <Text style={S.hDocDate}>Date : {f.date.slice(0, 10)}</Text>
          </View>
        </View>

        {/* ── Pied de page fixe ── */}
        <View
          fixed
          style={S.footer}
          render={(p: { pageNumber: number; totalPages?: number }) => (
            <>
              <Text style={S.fText}>
                Marabu Services · Abidjan, Côte d'Ivoire{'\n'}
                Paiement par virement bancaire à l'ordre de Marabu Services
              </Text>
              <Text style={S.fRight}>
                Page {p.pageNumber}{p.totalPages ? ` / ${p.totalPages}` : ''}
              </Text>
            </>
          )}
        />

        {/* ── Émetteur / Client ── */}
        <View style={S.partiesRow}>
          <View style={S.partyBox}>
            <Text style={S.secTitle}>Émetteur</Text>
            <Text style={S.partyName}>Marabu Services</Text>
            <Text style={S.partyInfo}>Cabinet de conseil en management</Text>
            <Text style={S.partyInfo}>Abidjan, Côte d'Ivoire</Text>
          </View>
          <View style={S.partyBoxRight}>
            <Text style={S.secTitle}>Facturé à</Text>
            <Text style={S.partyName}>{f.mission.client}</Text>
            <Text style={S.partyInfo}>Mission : {f.mission.nom}</Text>
          </View>
        </View>

        {/* ── Tableau prestations ── */}
        <View style={S.tblHead}>
          <Text style={[S.tblHCell, { flex: 1 }]}>Désignation</Text>
          <Text style={[S.tblHCell, { width: 40, textAlign: 'center' }]}>Qté</Text>
          <Text style={[S.tblHCell, { width: 100, textAlign: 'right' }]}>Prix unitaire HT</Text>
          <Text style={[S.tblHCell, { width: 100, textAlign: 'right' }]}>Montant HT</Text>
        </View>
        <View style={S.tblRow}>
          <View style={{ flex: 1 }}>
            <Text style={[S.tblCell, { fontFamily: 'Helvetica-Bold' }]}>
              Prestation de conseil — {f.mission.nom}
            </Text>
            <Text style={S.tblSub}>Client : {f.mission.client}</Text>
          </View>
          <Text style={[S.tblCell, { width: 40, textAlign: 'center' }]}>1</Text>
          <Text style={[S.tblCell, { width: 100, textAlign: 'right', fontFamily: 'Helvetica' }]}>
            {fmtN(f.ht)} FCFA
          </Text>
          <Text style={[S.tblCell, { width: 100, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
            {fmtN(f.ht)} FCFA
          </Text>
        </View>

        {/* ── Totaux ── */}
        <View style={S.totalsWrap}>
          <View style={S.totalsBox}>
            <View style={S.totRow}>
              <Text style={S.totLbl}>Sous-total HT</Text>
              <Text style={S.totVal}>{fmtN(f.ht)} FCFA</Text>
            </View>
            {f.tvaType === '18' ? (
              <View style={S.totRow}>
                <Text style={S.totLbl}>TVA 18%</Text>
                <Text style={S.totVal}>{fmtN(tvaMontant)} FCFA</Text>
              </View>
            ) : (
              <View style={S.totRow}>
                <Text style={S.totLbl}>TVA</Text>
                <Text style={[S.totVal, { color: GRAY, fontSize: 9 }]}>Exonérée</Text>
              </View>
            )}
            <View style={S.totGrandRow}>
              <Text style={S.totGrandLbl}>TOTAL TTC</Text>
              <Text style={S.totGrandVal}>{fmtN(f.ttc)} FCFA</Text>
            </View>
            {totalEnc > 0 && (
              <View style={S.totEncRow}>
                <Text style={S.totEncLbl}>Encaissé</Text>
                <Text style={S.totEncVal}>{fmtN(totalEnc)} FCFA</Text>
              </View>
            )}
            {solde > 0 && (
              <View style={S.totSoldeRow}>
                <Text style={S.totSoldeLbl}>Solde restant</Text>
                <Text style={S.totSoldeVal}>{fmtN(solde)} FCFA</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Échéancier ── */}
        {f.tranches.length > 0 && (
          <View>
            <Text style={S.echTitle}>Échéancier de paiement</Text>
            <View style={S.echHead}>
              <Text style={[S.echHCell, { width: 70 }]}>Tranche</Text>
              <Text style={[S.echHCell, { flex: 1, textAlign: 'right' }]}>Montant (FCFA)</Text>
              <Text style={[S.echHCell, { width: 90, textAlign: 'right' }]}>Échéance</Text>
              <Text style={[S.echHCell, { width: 90, textAlign: 'right' }]}>Statut</Text>
            </View>
            {f.tranches.map(t => {
              const sold = t.encaisse >= t.montant;
              const part = t.encaisse > 0 && !sold;
              const statut = sold ? 'Soldé' : part ? 'Partiel' : 'En attente';
              const statutColor = sold ? GREEN : part ? '#92400e' : GRAY;
              return (
                <View key={t.id} style={S.echRow}>
                  <Text style={[S.echCell, { width: 70 }]}>Tranche {t.num}</Text>
                  <Text style={[S.echCell, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                    {fmtN(t.montant)}
                  </Text>
                  <Text style={[S.echCell, { width: 90, textAlign: 'right' }]}>
                    {t.echeance.slice(0, 10)}
                  </Text>
                  <Text style={[S.echBadge, { width: 90, textAlign: 'right', color: statutColor }]}>
                    {statut}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Mentions légales ── */}
        <View style={S.legal}>
          <Text style={S.legalText}>
            Paiement par virement bancaire à l'ordre de Marabu Services.
          </Text>
          <Text style={S.legalText}>
            En cas de retard de paiement, des pénalités de retard pourront être appliquées
            conformément à la législation en vigueur en Côte d'Ivoire.
          </Text>
          <Text style={S.legalCenter}>Merci de votre confiance.</Text>
        </View>

      </Page>
    </Document>
  );
}

// ── Fonction utilitaire : ouvrir le PDF dans un nouvel onglet ────────
export async function openFacturePdf(facture: ApiFacture): Promise<void> {
  const blob = await pdf(<FacturePdfDoc f={facture} />).toBlob();
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // libère l'URL après 60s
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
