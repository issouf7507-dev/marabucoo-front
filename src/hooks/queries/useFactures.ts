import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facturesService, type FactureInput, type TrancheUpdate } from '../../services/factures.service';
import { MISSIONS_KEY } from './useMissions';

export const FACTURES_KEY = ['factures'] as const;

export function useFactures() {
  return useQuery({ queryKey: FACTURES_KEY, queryFn: facturesService.getAll });
}

export function useCreateFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FactureInput) => facturesService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: FACTURES_KEY }),
  });
}

export function useUpdateFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FactureInput> }) =>
      facturesService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: FACTURES_KEY }),
  });
}

export function useDeleteFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => facturesService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: FACTURES_KEY }),
  });
}

export function useUpdateTranche() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ factureId, tid, data }: { factureId: number; tid: number; data: TrancheUpdate }) =>
      facturesService.updateTranche(factureId, tid, data),
    onSuccess: () => {
      // Invalide factures ET missions (avance recalculée côté serveur)
      qc.invalidateQueries({ queryKey: FACTURES_KEY });
      qc.invalidateQueries({ queryKey: MISSIONS_KEY });
    },
  });
}
