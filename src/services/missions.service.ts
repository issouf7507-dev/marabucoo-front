import { api } from './api';
import type { MissionInput } from '../schemas';

export type ApiMission = {
  id: number;
  nom: string;
  client: string;
  apporteur: string | null;
  statut: string;
  montant: number;
  avance: number;
  debut: string | null;
  fin: string | null;
  tva: string | null;
  nature: string | null;
  desc: string | null;
  createdAt: string;
  updatedAt: string;
  encaissements: { mois: string; montant: number }[];
};

function toApiBody(data: MissionInput) {
  return { ...data, statut: data.statut.toUpperCase() };
}

function toApiBodyPartial(data: Partial<MissionInput>) {
  return data.statut ? { ...data, statut: data.statut.toUpperCase() } : data;
}

export const missionsService = {
  getAll:    ()                              => api.get<ApiMission[]>('/missions'),
  getOne:    (id: number)                   => api.get<ApiMission>(`/missions/${id}`),
  create:    (data: MissionInput)           => api.post<ApiMission>('/missions', toApiBody(data)),
  update:    (id: number, data: Partial<MissionInput>) => api.put<ApiMission>(`/missions/${id}`, toApiBodyPartial(data)),
  remove:    (id: number)                   => api.delete<void>(`/missions/${id}`),
  updateEnc: (id: number, enc: Record<string, number>) => api.put<void>(`/missions/${id}/enc`, enc),
  sync:      ()                             => api.post<{ synced: number; total: number }>('/missions/sync', {}),
};
