import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { petiteCaisseService } from '../../services/petitecaisse.service';
import type { PetiteCaisseInput } from '../../schemas';

export const PC_KEY = ['petite-caisse'] as const;

export function usePetiteCaisse() {
  return useQuery({
    queryKey: PC_KEY,
    queryFn: () => petiteCaisseService.getAll(),
  });
}

export function useCreatePC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PetiteCaisseInput) => petiteCaisseService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PC_KEY }),
  });
}

export function useUpdatePC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PetiteCaisseInput> }) =>
      petiteCaisseService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PC_KEY }),
  });
}

export function useDeletePC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => petiteCaisseService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PC_KEY }),
  });
}
