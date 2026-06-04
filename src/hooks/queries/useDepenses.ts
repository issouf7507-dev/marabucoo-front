import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { depensesService } from '../../services/depenses.service';
import type { DepenseInput } from '../../schemas';
import { PARAMS_KEY } from './useParams';

export const DEPENSES_KEY = ['depenses'] as const;

export function useDepenses(periode?: string) {
  return useQuery({
    queryKey: [...DEPENSES_KEY, { periode }],
    queryFn: () => depensesService.getAll(periode),
  });
}

export function useCreateDepense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DepenseInput) => depensesService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DEPENSES_KEY });
      qc.invalidateQueries({ queryKey: PARAMS_KEY });
    },
  });
}

export function useUpdateDepense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DepenseInput> }) =>
      depensesService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DEPENSES_KEY });
      qc.invalidateQueries({ queryKey: PARAMS_KEY });
    },
  });
}

export function useDeleteDepense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => depensesService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DEPENSES_KEY });
      qc.invalidateQueries({ queryKey: PARAMS_KEY });
    },
  });
}
