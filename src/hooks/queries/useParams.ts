import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paramsService } from '../../services/params.service';
import type { ParamsInput } from '../../schemas';

export const PARAMS_KEY = ['params'] as const;

export function useParams() {
  return useQuery({
    queryKey: PARAMS_KEY,
    queryFn: paramsService.get,
  });
}

export function useUpdateParams() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ParamsInput>) => paramsService.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PARAMS_KEY }),
  });
}
