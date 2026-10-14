import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repo } from '../data';
import type { TaskSlice } from '../data/types';

const slicesKey = (from: string, to: string) => ['slices', from, to];

export function useSlices(from: string, to: string) {
  return useQuery({
    queryKey: slicesKey(from, to),
    queryFn: () => repo.listSlices(from, to),
    enabled: !!from && !!to,
  });
}

export function useReplaceTaskSlices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, slices }: { taskId: string; slices: Omit<TaskSlice, 'id' | 'taskId'>[] }) =>
      repo.replaceTaskSlices(taskId, slices),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slices'] }),
  });
}
