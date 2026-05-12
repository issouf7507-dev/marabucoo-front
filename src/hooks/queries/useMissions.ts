import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { missionsService } from '../../services/missions.service';
import type { MissionInput } from '../../schemas';

export const MISSIONS_KEY = ['missions'] as const;

export function useMissions() {
  return useQuery({
    queryKey: MISSIONS_KEY,
    queryFn: missionsService.getAll,
  });
}

export function useMission(id: number) {
  return useQuery({
    queryKey: [...MISSIONS_KEY, id],
    queryFn: () => missionsService.getOne(id),
    enabled: id > 0,
  });
}

export function useCreateMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MissionInput) => missionsService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: MISSIONS_KEY }),
  });
}

export function useUpdateMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MissionInput> }) =>
      missionsService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: MISSIONS_KEY }),
  });
}

export function useDeleteMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => missionsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: MISSIONS_KEY }),
  });
}

export function useUpdateEnc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enc }: { id: number; enc: Record<string, number> }) =>
      missionsService.updateEnc(id, enc),
    onSuccess: () => qc.invalidateQueries({ queryKey: MISSIONS_KEY }),
  });
}
