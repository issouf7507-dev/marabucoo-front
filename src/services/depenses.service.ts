import { api } from './api';
import type { DepenseInput } from '../schemas';

export interface ApiDepense {
  id: number;
  type: string;
  categorie: string | null;
  periode: string | null;
  intitule: string | null;
  date: string;
  designation: string;
  prestataire: string | null;
  montant: number;
  credit: number;
  debit: number;
  fraisTransf: number;
  penalite: number;
  reference: string | null;
  nature: string;
}

export const depensesService = {
  getAll: (periode?: string) => api.get<ApiDepense[]>(`/depenses${periode ? `?periode=${periode}` : ''}`),
  create: (data: DepenseInput) => api.post<ApiDepense>('/depenses', {
    type: data.type, categorie: data.cat, periode: data.per, intitule: data.int,
    date: data.date, designation: data.des, prestataire: data.prest,
    montant: data.mnt, fraisTransf: data.ft, penalite: data.pen,
    reference: data.ref, nature: data.nature,
  }),
  update: (id: number, data: Partial<DepenseInput>) => api.put<ApiDepense>(`/depenses/${id}`, data),
  remove: (id: number) => api.delete<void>(`/depenses/${id}`),
};
