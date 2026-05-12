export const MF = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
export const MK = ['jan','fev','mar','avr','mai','jun','jul','aou','sep','oct','nov','dec'] as const;

export const THIS_YEAR = new Date().getFullYear();
export const YEAR_OPTIONS = Array.from({ length: 4 }, (_, i) => THIS_YEAR - 1 + i); // N-1 → N+2

export const fmt = (n: number | null | undefined): string =>
  n == null ? '—' : Math.round(n).toLocaleString('fr-FR');

export const fmtS = (n: number): string =>
  n >= 0 ? '+' + fmt(n) : '-' + fmt(-n);

export const initials = (s: string): string =>
  (s || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();

export const ST_LABEL: Record<string, string> = {
  prospect: 'Prospect', tdr: 'TDR envoyé', propale: 'Propale',
  contrat: 'Contrat', en_cours: 'En cours', termine: 'Terminé', perdu: 'Perdu'
};

export const ST_CLS: Record<string, string> = {
  prospect: 'bp', tdr: 'bb', propale: 'ba', contrat: 'bp',
  en_cours: 'bg', termine: 'bn', perdu: 'br'
};

export const CAT_LBL: Record<string, string> = {
  RH: 'Ressources humaines', EXPLOIT: 'Exploitation', UTIL: 'Utilités', VAR: 'Variable'
};
