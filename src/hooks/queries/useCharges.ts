import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chargesService } from '../../services/charges.service';
import type { ChargeInput } from '../../schemas';

export const CHARGES_KEY = ['charges'] as const;

export function useCharges() {
  return useQuery({
    queryKey: CHARGES_KEY,
    queryFn: chargesService.getAll,
  });
}

export function useCreateCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ChargeInput) => chargesService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CHARGES_KEY }),
  });
}

export function useUpdateCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ChargeInput> }) =>
      chargesService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CHARGES_KEY }),
  });
}

export function useDeleteCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => chargesService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: CHARGES_KEY }),
  });
}

export function useUpsertChargeReel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mois, annee, montant, statut, datePmt }: { id: number; mois: string; annee: number; montant: number; statut?: string; datePmt?: string }) =>
      chargesService.upsertReel(id, mois, annee, montant, statut, datePmt),
    onSuccess: () => qc.invalidateQueries({ queryKey: CHARGES_KEY }),
  });
}
