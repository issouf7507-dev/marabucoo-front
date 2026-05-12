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
}

export const paramsService = {
  get: () => api.get<ApiParams>('/params'),
  update: (data: Partial<ParamsInput>) => api.put<ApiParams>('/params', {
    banque: data.banque, coffre: data.coffre, masseSal: data.masse_sal,
    chargesPat: data.charges_pat, primesMens: data.primes_mens,
    arrSal: data.arr_sal, arrSalR: data.arr_sal_r, arrSalM: data.arr_sal_m,
    arrPrim: data.arr_prim, arrPrimM: data.arr_prim_m,
  }),
};
