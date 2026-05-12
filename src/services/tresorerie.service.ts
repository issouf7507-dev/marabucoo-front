import { api } from './api';

export interface ApiTresorerie {
  id:      number;
  mois:    string;
  annee:   number;
  type:    string;
  banque:  number;
  coffre:  number;
  entrees: number;
  chgPrev: number;
  chgPay:  number;
  reste:   number;
}

export interface TresoInput {
  type?:    string;
  banque?:  number;
  coffre?:  number;
  entrees?: number;
  chgPrev?: number;
  chgPay?:  number;
  reste?:   number;
}

export const tresorerieService = {
  getAll: (annee: number) =>
    api.get<ApiTresorerie[]>(`/tresorerie?annee=${annee}`),
  upsert: (mois: string, annee: number, data: TresoInput) =>
    api.put<ApiTresorerie>(`/tresorerie/${encodeURIComponent(mois)}/${annee}`, data),
};
