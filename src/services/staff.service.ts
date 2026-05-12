import { api } from './api';
import type { StaffInput } from '../schemas';

export interface ApiStaff {
  id: number;
  nom: string;
  poste: string | null;
  salaire: number;
  nature: string;
  debut: string | null;
  fin: string | null;
  marabu: boolean;
  actif: boolean;
  paies: { mois: string; annee: number; montant: number | null; statut: string | null }[];
}

export const staffService = {
  getAll: () => api.get<ApiStaff[]>('/staff'),
  create: (data: StaffInput) => api.post<ApiStaff>('/staff', { ...data, salaire: data.sal }),
  update: (id: number, data: Partial<StaffInput>) => api.put<ApiStaff>(`/staff/${id}`, { ...data, salaire: data.sal }),
  remove: (id: number) => api.delete<void>(`/staff/${id}`),
  upsertPaie: (id: number, mois: string, annee: number, montant: number | null, statut: string | null) =>
    api.put<void>(`/staff/${id}/paie`, { mois, annee, montant, statut }),
};
