import { api } from './api';
import type { PetiteCaisseInput } from '../schemas';

export interface ApiPetiteCaisse {
  id:          number;
  num:         string;
  caisse:      string;
  type:        string;
  categorie:   string | null;
  nature:      string;
  periode:     string | null;
  date:        string;
  designation: string;
  prestataire: string | null;
  entree:      number;
  sortie:      number;
  penalite:    number;
  solde:       number;
  refFacture:  string | null;
}

export const petiteCaisseService = {
  getAll: () => api.get<ApiPetiteCaisse[]>('/petite-caisse'),
  create: (data: PetiteCaisseInput) => api.post<ApiPetiteCaisse>('/petite-caisse', {
    caisse:      data.caisse,
    type:        data.type,
    categorie:   data.cat,
    nature:      data.nature,
    periode:     data.per,
    date:        data.date,
    designation: data.des,
    prestataire: data.prest,
    entree:      data.entree,
    sortie:      data.sortie,
    penalite:    data.pen,
    refFacture:  data.refFacture || null,
  }),
  update: (id: number, data: Partial<PetiteCaisseInput>) => api.put<ApiPetiteCaisse>(`/petite-caisse/${id}`, {
    ...(data.caisse      && { caisse:      data.caisse }),
    ...(data.type        && { type:        data.type }),
    ...(data.cat   != null && { categorie:   data.cat }),
    ...(data.nature      && { nature:      data.nature }),
    ...(data.per   != null && { periode:     data.per }),
    ...(data.date        && { date:        data.date }),
    ...(data.des         && { designation: data.des }),
    ...(data.prest != null && { prestataire: data.prest }),
    ...(data.entree != null && { entree:     data.entree }),
    ...(data.sortie != null && { sortie:     data.sortie }),
    ...(data.pen   != null && { penalite:   data.pen }),
    refFacture: data.refFacture || null,
  }),
  remove: (id: number) => api.delete<void>(`/petite-caisse/${id}`),
};
