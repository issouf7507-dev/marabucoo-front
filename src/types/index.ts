export type MonthKey = 'jan'|'fev'|'mar'|'avr'|'mai'|'jun'|'jul'|'aou'|'sep'|'oct'|'nov'|'dec';
export type MonthRecord<T> = Record<MonthKey, T>;

export interface Staff {
  id: number;
  nom: string;
  poste: string;
  sal: number;
  nature: string;
  debut: string;
  fin: string;
  marabu: boolean;
  actif: boolean;
  paie: MonthRecord<number | null>;
  statut: MonthRecord<string | null>;
}

export interface Mission {
  id: number;
  nom: string;
  client: string;
  apporteur: string;
  statut: string;
  montant: number;
  avance: number;
  debut: string;
  fin: string;
  tva: string;
  nature: string;
  desc: string;
  docs: string[];
  enc: MonthRecord<number>;
}

export interface Tranche {
  id: number;
  num: number;
  mnt: number;
  ech: string;
  enc: number;
  date_enc: string;
  ref: string;
  statut: string;
  docs: string[];
}

export interface Facture {
  id: number;
  mis_id: number;
  num: string;
  date: string;
  ht: number;
  tva_t: string;
  tva_m: number;
  ttc: number;
  docs: string[];
  tranches: Tranche[];
}

export interface Charge {
  id: number;
  lib: string;
  cat: string;
  nature: string;
  type: string;
  per: string;
  budget: number;
  obs: string;
  r: MonthRecord<number>;
  st: MonthRecord<string | null>;
  dp: MonthRecord<string>;
}

export interface Depense {
  id: number;
  type: string;
  cat: string;
  per: string;
  int: string;
  date: string;
  des: string;
  prest: string;
  mnt: number;
  credit: number;
  debit: number;
  ft: number;
  pen: number;
  ref: string;
  nature: string;
  doc: string[];
}

export interface PetiteCaisse {
  id: number;
  num: string;
  caisse: string;
  type: string;
  cat: string;
  nature: string;
  per: string;
  date: string;
  des: string;
  prest: string;
  entree: number;
  sortie: number;
  pen: number;
  solde: number;
  doc: string[];
}

export interface TresoRow {
  mois: string;
  type: string;
  banque: number;
  coffre: number;
  entrees: number;
  chg_prev: number;
  chg_pay: number;
  reste: number;
}

export interface Params {
  banque: number;
  coffre: number;
  masse_sal: number;
  charges_pat: number;
  primes_mens: number;
  arr_sal: number;
  arr_sal_r: number;
  arr_sal_m: number;
  arr_prim: number;
  arr_prim_m: number;
}

export interface DB {
  params: Params;
  staff: Staff[];
  missions: Mission[];
  factures: Facture[];
  charges: Charge[];
  depenses: Depense[];
  petite_caisse: PetiteCaisse[];
  tresorerie: TresoRow[];
  nextId: Record<string, number>;
}

export type PageId = 'dashboard'|'missions'|'facturation'|'encaissements'|'salaires'|'charges'|'depenses'|'petite-caisse'|'tresorerie'|'bfr'|'tva'|'parametres';
