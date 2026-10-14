import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repo } from '../data';
import type { TaskFilters, TaskInput, TaskPatch } from '../data/types';

export const taskKeys = {
  all: ['tasks'] as const,
  list: (filters?: TaskFilters) => ['tasks', 'list', filters] as const,
};

export function useTasks(filters?: TaskFilters) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => repo.listTasks(filters),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) => repo.createTask(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskPatch }) => repo.updateTask(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.deleteTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}
