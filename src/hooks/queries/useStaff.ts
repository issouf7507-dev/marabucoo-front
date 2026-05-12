import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffService } from '../../services/staff.service';
import type { StaffInput } from '../../schemas';

export const STAFF_KEY = ['staff'] as const;

export function useStaff() {
  return useQuery({
    queryKey: STAFF_KEY,
    queryFn: staffService.getAll,
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StaffInput) => staffService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: STAFF_KEY }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<StaffInput> }) =>
      staffService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: STAFF_KEY }),
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => staffService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: STAFF_KEY }),
  });
}

export function useUpsertPaie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mois, annee, montant, statut }: { id: number; mois: string; annee: number; montant: number | null; statut: string | null }) =>
      staffService.upsertPaie(id, mois, annee, montant, statut),
    onSuccess: () => qc.invalidateQueries({ queryKey: STAFF_KEY }),
  });
}
