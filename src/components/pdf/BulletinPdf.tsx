import {
  Document, Page, Text, View, StyleSheet, pdf,
} from '@react-pdf/renderer';
import type { ApiStaff } from '../../services/staff.service';

// ── Couleurs ─────────────────────────────────────────────────────────
const GREEN = '#1B5E40';
const DARK = '#18181b';
const GRAY = '#71717a';
const LIGHT = '#f4f4f5';
const BORDER = '#e4e4e8';
const WHITE = '#ffffff';

const fmtN = (n: number) =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function today() {
  return new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

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
    top: 0, left: 0, right: 0,
    height: 64,
    backgroundColor: GREEN,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  hCompany: { color: WHITE, fontSize: 16, fontFamily: 'Helvetica-Bold' },
  hSub: { color: 'rgba(255,255,255,0.72)', fontSize: 8, marginTop: 2 },
  hDocType: { color: WHITE, fontSize: 20, fontFamily: 'Helvetica-Bold' },
  hDocSub: { color: 'rgba(255,255,255,0.9)', fontSize: 10, marginTop: 3, textAlign: 'right' },
  hDocDate: { color: 'rgba(255,255,255,0.65)', fontSize: 8, marginTop: 2, textAlign: 'right' },

  // ── Pied de page fixe ─────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 48,
    borderTopWidth: 1, borderTopColor: BORDER, borderTopStyle: 'solid',
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  fText: { color: GRAY, fontSize: 7.5 },
  fRight: { color: GRAY, fontSize: 7.5, textAlign: 'right' },

  // ── Étiquettes de section ─────────────────────────────────────────
  secTitle: {
    fontSize: 8, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 1,
    color: '#a1a1aa', marginBottom: 8,
  },

  // ── Blocs info collaborateur / période ────────────────────────────
  infoRow: { flexDirection: 'row', marginBottom: 20 },
  infoBox: { flex: 1, backgroundColor: LIGHT, borderRadius: 4, padding: 14 },
  infoBoxRight: { flex: 1, backgroundColor: LIGHT, borderRadius: 4, padding: 14, marginLeft: 16 },

  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: DARK,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  avatarText: { color: WHITE, fontSize: 13, fontFamily: 'Helvetica-Bold' },
  staffName: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  staffPoste: { fontSize: 10, color: GRAY, marginTop: 1 },

  infoLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  infoLbl: { fontSize: 10, color: GRAY },
  infoVal: { fontSize: 10, fontFamily: 'Helvetica-Bold' },

  // ── Tableau de rémunération ───────────────────────────────────────
  tblHead: {
    flexDirection: 'row',
    backgroundColor: DARK,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 2,
  },
  tblHCell: { color: WHITE, fontSize: 8.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  tblRow: {
    flexDirection: 'row',
    paddingHorizontal: 10, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: BORDER, borderBottomStyle: 'solid',
  },
  tblCell: { fontSize: 10 },
  tblFoot: {
    flexDirection: 'row',
    paddingHorizontal: 10, paddingVertical: 11,
    backgroundColor: LIGHT,
    borderTopWidth: 2, borderTopColor: DARK, borderTopStyle: 'solid',
    borderRadius: 2,
    marginBottom: 24,
  },
  netLbl: { flex: 1, fontSize: 13, fontFamily: 'Helvetica-Bold' },
  netVal: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: GREEN },

  // ── Signatures ────────────────────────────────────────────────────
  sigRow: { flexDirection: 'row', marginTop: 32 },
  sigBox: { flex: 1, alignItems: 'center' },
  sigBoxRight: { flex: 1, alignItems: 'center', marginLeft: 40 },
  sigLbl: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: GRAY, marginBottom: 4 },
  sigSub: { fontSize: 9, color: '#a1a1aa', marginBottom: 36 },
  sigLine: {
    borderTopWidth: 1, borderTopColor: DARK, borderTopStyle: 'solid',
    paddingTop: 5,
    alignSelf: 'stretch', textAlign: 'center',
    fontSize: 9, color: GRAY,
  },

  // ── Mentions ──────────────────────────────────────────────────────
  mention: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1, borderTopColor: BORDER, borderTopStyle: 'solid',
    textAlign: 'center',
    fontSize: 8.5, color: GRAY, lineHeight: 1.5,
    fontFamily: 'Helvetica-Oblique',
  },
});

// ── Initiales ────────────────────────────────────────────────────────
function initials(nom: string) {
  return (nom || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

// ── Document PDF ─────────────────────────────────────────────────────
interface BulletinPdfProps {
  staff: ApiStaff;
  moisLabel: string;
  annee: number;
  montant: number;
  statut: string;
}

function BulletinPdfDoc({ staff: s, moisLabel, annee, montant, statut }: BulletinPdfProps) {
  const ecart = montant - s.salaire;
  const periode = `${moisLabel.toUpperCase()} ${annee}`;
  const dateEdition = today();
  const statutColor = statut === 'Payé' ? GREEN : '#92400e';

  return (
    <Document
      title={`Bulletin de paie — ${s.nom} — ${periode}`}
      author="Marabu Services"
      subject={`Bulletin de paie ${s.nom}`}
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
            <Text style={S.hDocType}>BULLETIN DE PAIE</Text>
            <Text style={S.hDocSub}>{periode}</Text>
            <Text style={S.hDocDate}>Édité le {dateEdition}</Text>
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
                Ce bulletin est un document confidentiel.
              </Text>
              <Text style={S.fRight}>
                Page {p.pageNumber}{p.totalPages ? ` / ${p.totalPages}` : ''}
              </Text>
            </>
          )}
        />

        {/* ── Collaborateur / Période ── */}
        <View style={S.infoRow}>
          {/* Collaborateur */}
          <View style={S.infoBox}>
            <Text style={S.secTitle}>Collaborateur</Text>
            <View style={S.avatarRow}>
              <View style={S.avatar}>
                <Text style={S.avatarText}>{initials(s.nom)}</Text>
              </View>
              <View>
                <Text style={S.staffName}>{s.nom}</Text>
                <Text style={S.staffPoste}>{s.poste ?? '—'}</Text>
              </View>
            </View>
            <View style={S.infoLine}>
              <Text style={S.infoLbl}>Type de contrat</Text>
              <Text style={S.infoVal}>{s.nature}</Text>
            </View>
            <View style={S.infoLine}>
              <Text style={S.infoLbl}>Charge Marabu</Text>
              <Text style={S.infoVal}>{s.marabu ? 'Oui' : 'Non'}</Text>
            </View>
            {s.debut && (
              <View style={S.infoLine}>
                <Text style={S.infoLbl}>Date d'entrée</Text>
                <Text style={S.infoVal}>{s.debut.slice(0, 10)}</Text>
              </View>
            )}
          </View>

          {/* Période */}
          <View style={S.infoBoxRight}>
            <Text style={S.secTitle}>Période & Statut</Text>
            <View style={S.infoLine}>
              <Text style={S.infoLbl}>Période</Text>
              <Text style={S.infoVal}>{moisLabel} {annee}</Text>
            </View>
            <View style={S.infoLine}>
              <Text style={S.infoLbl}>Statut paiement</Text>
              <Text style={[S.infoVal, { color: statutColor }]}>{statut}</Text>
            </View>
            <View style={S.infoLine}>
              <Text style={S.infoLbl}>Date d'édition</Text>
              <Text style={S.infoVal}>{dateEdition}</Text>
            </View>
          </View>
        </View>

        {/* ── Tableau de rémunération ── */}
        <Text style={S.secTitle}>Détail de la rémunération</Text>
        <View style={S.tblHead}>
          <Text style={[S.tblHCell, { flex: 1 }]}>Rubrique</Text>
          <Text style={[S.tblHCell, { width: 120, textAlign: 'right' }]}>Base (FCFA)</Text>
          <Text style={[S.tblHCell, { width: 120, textAlign: 'right' }]}>Montant (FCFA)</Text>
        </View>

        {/* Salaire de base */}
        <View style={S.tblRow}>
          <Text style={[S.tblCell, { flex: 1, fontFamily: 'Helvetica-Bold' }]}>Salaire de base</Text>
          <Text style={[S.tblCell, { width: 120, textAlign: 'right' }]}>{fmtN(s.salaire)}</Text>
          <Text style={[S.tblCell, { width: 120, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmtN(s.salaire)}</Text>
        </View>

        {/* Prime ou retenue si écart */}
        {ecart !== 0 && (
          <View style={S.tblRow}>
            <Text style={[S.tblCell, { flex: 1, color: ecart > 0 ? GREEN : '#dc2626' }]}>
              {ecart > 0 ? 'Prime / Complément' : 'Retenue / Ajustement'}
            </Text>
            <Text style={[S.tblCell, { width: 120, textAlign: 'right', color: GRAY }]}>—</Text>
            <Text style={[S.tblCell, { width: 120, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: ecart > 0 ? GREEN : '#dc2626' }]}>
              {ecart > 0 ? '+' : ''}{fmtN(ecart)}
            </Text>
          </View>
        )}

        {/* NET À PAYER */}
        <View style={S.tblFoot}>
          <Text style={S.netLbl}>NET À PAYER</Text>
          <Text style={S.netVal}>{fmtN(montant)} FCFA</Text>
        </View>

        {/* ── Signatures ── */}
        <View style={S.sigRow}>
          <View style={S.sigBox}>
            <Text style={S.sigLbl}>Signature employeur</Text>
            <Text style={S.sigSub}>Marabu Services</Text>
            <Text style={S.sigLine}>Signature &amp; Date</Text>
          </View>
          <View style={S.sigBoxRight}>
            <Text style={S.sigLbl}>Signature collaborateur</Text>
            <Text style={S.sigSub}>Lu et approuvé</Text>
            <Text style={S.sigLine}>Signature &amp; Date</Text>
          </View>
        </View>

        {/* ── Mention confidentialité ── */}
        <Text style={S.mention}>
          Marabu Services — Abidjan, Côte d'Ivoire{'\n'}
          Ce bulletin est un document confidentiel réservé à l'usage personnel du collaborateur.
        </Text>

      </Page>
    </Document>
  );
}

// ── Fonction utilitaire : ouvrir le PDF dans un nouvel onglet ────────
export async function openBulletinPdf(
  staff: ApiStaff,
  moisLabel: string,
  annee: number,
  montant: number,
  statut: string,
): Promise<void> {
  const blob = await pdf(
    <BulletinPdfDoc
      staff={staff}
      moisLabel={moisLabel}
      annee={annee}
      montant={montant}
      statut={statut}
    />
  ).toBlob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
