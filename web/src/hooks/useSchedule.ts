import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repo } from '../data';
import type { DayCapacity, WorkWindow } from '../data/types';

const windowsKey = ['workWindows'];
const capacitiesKey = (from: string, to: string) => ['dayCapacities', from, to];

export function useWorkWindows() {
  return useQuery({ queryKey: windowsKey, queryFn: () => repo.listWorkWindows() });
}

export function useSetWorkWindows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (windows: Omit<WorkWindow, 'id'>[]) => repo.setWorkWindows(windows),
    onSuccess: () => qc.invalidateQueries({ queryKey: windowsKey }),
  });
}

export function useDayCapacities(from: string, to: string) {
  return useQuery({
    queryKey: capacitiesKey(from, to),
    queryFn: () => repo.listDayCapacities(from, to),
    enabled: !!from && !!to,
  });
}

export function useUpsertDayCapacity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (capacity: DayCapacity) => repo.upsertDayCapacity(capacity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dayCapacities'] });
    },
  });
}
