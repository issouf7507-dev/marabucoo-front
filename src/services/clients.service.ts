import { api } from './api';

export interface ApiClient {
  id:               number;
  nom:              string;
  secteur:          string | null;
  tel:              string | null;
  email:            string | null;
  ncc:              string | null;
  fneTemplate:      string | null;
  fnePointOfSale:   string | null;
  fneEstablishment: string | null;
  createdAt:        string;
  updatedAt:        string;
}

export type ClientInput = {
  nom:              string;
  secteur?:         string;
  tel?:             string;
  email?:           string;
  ncc?:             string;
  fneTemplate?:     string;
  fnePointOfSale?:  string;
  fneEstablishment?: string;
};

export const clientsService = {
  getAll:  ()                                       => api.get<ApiClient[]>('/clients'),
  create:  (data: ClientInput)                      => api.post<ApiClient>('/clients', data),
  update:  (id: number, data: Partial<ClientInput>) => api.put<ApiClient>(`/clients/${id}`, data),
  remove:  (id: number)                             => api.delete<void>(`/clients/${id}`),
};
