import { api } from './api';
import type { ParamsInput } from '../schemas';

export interface ApiParams {
  id: number;
  banque: number;
  coffre: number;
  masseSal: number;
  chargesPat: number;
  primesMens: number;
  arrSal: number;
  arrSalR: number;
  arrSalM: number;
  arrPrim: number;
  arrPrimM: number;
  totalFraisTransf: number;
  totalPenalite: number;
}

export const paramsService = {
  get: () => api.get<ApiParams>('/params'),
  update: (data: Partial<ParamsInput>) => api.put<ApiParams>('/params', {
    chargesPat: data.charges_pat, primesMens: data.primes_mens,
    arrSalM: data.arr_sal_m, arrPrim: data.arr_prim, arrPrimM: data.arr_prim_m,
  }),
};
