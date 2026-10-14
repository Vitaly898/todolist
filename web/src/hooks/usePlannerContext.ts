import { useSettings } from './useSettings';
import { useWorkWindows, useDayCapacities } from './useSchedule';
import { useSlices } from './useSlices';
import { useTasks } from './useTasks';
import type { PlannerContext } from '../domain/planner';
import { toISODate } from '../features/calendar/utils';

export function usePlannerContext(from: string, to: string): { ctx?: PlannerContext; isLoading: boolean } {
  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const { data: slices, isLoading: slicesLoading } = useSlices(from, to);
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: windows, isLoading: windowsLoading } = useWorkWindows();
  const { data: capacities, isLoading: capacitiesLoading } = useDayCapacities(from, to);

  if (tasksLoading || slicesLoading || settingsLoading || windowsLoading || capacitiesLoading) {
    return { isLoading: true };
  }

  return {
    ctx: {
      tasks: tasks ?? [],
      slices: slices ?? [],
      settings: settings!,
      workWindows: windows ?? [],
      dayCapacities: capacities ?? [],
      today: toISODate(new Date()),
    },
    isLoading: false,
  };
}
