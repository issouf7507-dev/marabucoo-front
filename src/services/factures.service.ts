import { api } from './api';

export type ApiTranche = {
  id: number;
  factureId: number;
  num: number;
  montant: number;
  echeance: string;
  encaisse: number;
  dateEnc: string | null;
  ref: string | null;
  statut: string;
};

export type ApiFacture = {
  id: number;
  missionId: number;
  num: string;
  date: string;
  ht: number;
  tvaType: string;
  tvaMontant: number;
  ttc: number;
  createdAt: string;
  updatedAt: string;
  mission: { id: number; nom: string; client: string };
  tranches: ApiTranche[];
};

export type FactureInput = {
  missionId: number;
  num: string;
  date: string;
  ht: number;
  tvaType: 'exo' | '18';
  tranches: { montant: number; echeance: string }[];
};

export type TrancheUpdate = {
  encaisse: number;
  dateEnc?: string;
  ref?: string;
  statut?: string;
};

export const facturesService = {
  getAll:        ()                                         => api.get<ApiFacture[]>('/factures'),
  getOne:        (id: number)                              => api.get<ApiFacture>(`/factures/${id}`),
  create:        (data: FactureInput)                      => api.post<ApiFacture>('/factures', data),
  update:        (id: number, data: Partial<FactureInput>) => api.put<ApiFacture>(`/factures/${id}`, data),
  remove:        (id: number)                              => api.delete<void>(`/factures/${id}`),
  updateTranche: (factureId: number, tid: number, data: TrancheUpdate) =>
    api.put<ApiTranche>(`/factures/${factureId}/tranches/${tid}`, data),
};
