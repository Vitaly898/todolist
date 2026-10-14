import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repo } from '../data';
import type { Settings } from '../data/types';

const key = ['settings'];

export function useSettings() {
  return useQuery({ queryKey: key, queryFn: () => repo.getSettings() });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => repo.updateSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}
