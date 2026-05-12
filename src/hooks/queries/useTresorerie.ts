import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tresorerieService, type TresoInput } from '../../services/tresorerie.service';

export const TRESO_KEY = ['tresorerie'] as const;

export function useTresorerie(annee: number) {
  return useQuery({
    queryKey: [...TRESO_KEY, annee],
    queryFn: () => tresorerieService.getAll(annee),
  });
}

export function useUpsertTresorerie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mois, annee, data }: { mois: string; annee: number; data: TresoInput }) =>
      tresorerieService.upsert(mois, annee, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TRESO_KEY }),
  });
}
