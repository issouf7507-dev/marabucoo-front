import { api } from './api';
import type { ChargeInput } from '../schemas';

export interface ApiCharge {
  id: number;
  libelle: string;
  categorie: string;
  nature: string;
  type: string;
  periodicite: string;
  budget: number;
  obs: string | null;
  realisations: { mois: string; annee: number; montant: number; statut: string | null; datePmt: string | null }[];
}

export const chargesService = {
  getAll: () => api.get<ApiCharge[]>('/charges'),
  create: (data: ChargeInput) => api.post<ApiCharge>('/charges', { libelle: data.lib, categorie: data.cat, nature: data.nature, type: data.type, periodicite: data.per, budget: data.budget, obs: data.obs }),
  update: (id: number, data: Partial<ChargeInput>) => api.put<ApiCharge>(`/charges/${id}`, { libelle: data.lib, categorie: data.cat, nature: data.nature, type: data.type, periodicite: data.per, budget: data.budget, obs: data.obs }),
  remove: (id: number) => api.delete<void>(`/charges/${id}`),
  upsertReel: (id: number, mois: string, annee: number, montant: number, statut?: string, datePmt?: string) =>
    api.put<void>(`/charges/${id}/reel`, { mois, annee, montant, statut, datePmt }),
};
