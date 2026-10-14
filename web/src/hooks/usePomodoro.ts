import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repo } from '../data';
import type { PomodoroSession } from '../data/types';

const sessionsKey = (from: string, to: string) => ['pomodoroSessions', from, to];

export function usePomodoroSessions(from: string, to: string) {
  return useQuery({
    queryKey: sessionsKey(from, to),
    queryFn: () => repo.listPomodoroSessions(from, to),
    enabled: !!from && !!to,
  });
}

export function useCreatePomodoroSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (session: Omit<PomodoroSession, 'id' | 'startedAt' | 'endedAt'>) =>
      repo.createPomodoroSession(session),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pomodoroSessions'] }),
  });
}

export function useFinishPomodoroSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actualMin }: { id: string; actualMin: number }) => repo.completeWorkSession(id, actualMin),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pomodoroSessions'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['slices'] });
    },
  });
}
