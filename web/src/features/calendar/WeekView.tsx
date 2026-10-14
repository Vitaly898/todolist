import { useState } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Task, TaskSlice } from '../../data/types';
import { TaskCard } from '../tasks/TaskCard';
import { TaskBar, type TaskBarData } from './TaskBar';
import { assignLanes, isTodayDate, taskSegmentsInWeek, taskStart, toISODate, weekDays } from './utils';
import { useDayCapacities } from '../../hooks/useSchedule';
import { useSettings } from '../../hooks/useSettings';
import { useUpdateTask } from '../../hooks/useTasks';
import { useReplaceTaskSlices } from '../../hooks/useSlices';
import { capacityForDate } from '../../domain/schedule';
import { plannedHoursForDate } from '../../domain/dayLoad';

interface WeekViewProps {
  week: Date;
  tasks: Task[];
  slices?: TaskSlice[];
  onTaskClick: (task: Task) => void;
  onDayClick: (date: Date) => void;
}

const MAX_WEEK_TASKS = 10;

function shiftISO(iso: string, days: number): string {
  return toISODate(addDays(parseISO(iso), days));
}

function DayDropZone({ id, today }: { id: string; today: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${today ? 'bg-sky-50/60 dark:bg-sky-950/20' : ''} ${isOver ? 'bg-emerald-100/60 dark:bg-emerald-900/30' : ''}`}
    />
  );
}

function DraggableTaskBar({
  bar,
  lane,
  onTaskClick,
}: {
  bar: TaskBarData;
  lane: number;
  onTaskClick: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `${bar.task.id}__${bar.startCol}`,
  });
  return (
    <TaskBar
      bar={bar}
      lane={lane}
      onClick={onTaskClick}
      dragRef={setNodeRef}
      dragListeners={listeners}
      dragAttributes={attributes}
      dragTransform={transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined}
    />
  );
}

export function WeekView({ week, tasks, slices = [], onTaskClick, onDayClick }: WeekViewProps) {
  const days = weekDays(week);
  const from = toISODate(days[0]);
  const to = toISODate(days[6]);
  const [expanded, setExpanded] = useState(false);

  const { data: settings } = useSettings();
  const { data: capacities } = useDayCapacities(from, to);
  const updateTask = useUpdateTask();
  const replaceSlices = useReplaceTaskSlices();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const sortedTasks = tasks
    .filter((t) => taskSegmentsInWeek(t, slices, from, to, days[0]).length > 0)
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
  const visibleTasks = expanded ? sortedTasks : sortedTasks.slice(0, MAX_WEEK_TASKS);
  const hiddenCount = sortedTasks.length - visibleTasks.length;

  const bars: TaskBarData[] = visibleTasks.flatMap((t) =>
    taskSegmentsInWeek(t, slices, from, to, days[0]).map((seg) => ({
      task: t,
      startCol: seg.startCol,
      endCol: seg.endCol,
      continuesLeft: seg.continuesLeft,
      continuesRight: seg.continuesRight,
    })),
  );
  const laneOf = assignLanes(
    bars.map((b) => ({ id: `${b.task.id}-${b.startCol}-${b.endCol}`, startCol: b.startCol, endCol: b.endCol })),
  );
  const laneCount = Math.max(1, ...bars.map((b) => (laneOf.get(`${b.task.id}-${b.startCol}-${b.endCol}`) ?? 0) + 1));

  // DnD: перетаскивание полоски сдвигает окно задачи (и её срезы) на delta дней
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const [taskId] = String(active.id).split('__');
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const target = String(over.id);
    const delta = differenceInCalendarDays(parseISO(target), parseISO(taskStart(task)));
    if (delta === 0) return;

    updateTask.mutate({
      id: task.id,
      patch: {
        startDate: shiftISO(taskStart(task), delta),
        deadline: task.deadline ? shiftISO(task.deadline, delta) : undefined,
      },
    });
    const taskSlices = slices.filter((s) => s.taskId === task.id);
    if (taskSlices.length) {
      replaceSlices.mutate({
        taskId: task.id,
        slices: taskSlices.map((s) => ({
          date: shiftISO(s.date, delta),
          plannedHours: s.plannedHours,
          doneHours: s.doneHours,
          manual: s.manual,
        })),
      });
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="min-w-[700px]">
        <div className="grid grid-cols-7 divide-x divide-slate-200 border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {days.map((day) => {
            const iso = toISODate(day);
            const capacity = settings ? capacityForDate(iso, capacities ?? [], settings) : 0;
            const planned = plannedHoursForDate(iso, tasks, slices);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onDayClick(day)}
                className={`px-2 py-2 text-center ${
                  isTodayDate(day) ? 'bg-sky-100 dark:bg-sky-900/40' : 'bg-slate-50 dark:bg-slate-900'
                }`}
              >
                <div className="text-xs text-slate-500">{format(day, 'EEEE', { locale: ru })}</div>
                <div className="text-sm font-semibold">{format(day, 'd MMM', { locale: ru })}</div>
                {settings && capacity > 0 && (
                  <div className={`mt-1 text-[10px] ${planned > capacity ? 'text-red-500' : 'text-slate-400'}`}>
                    {planned.toFixed(1)} / {capacity} ч
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="relative">
            <div className="absolute inset-0 grid grid-cols-7 divide-x divide-slate-100 dark:divide-slate-800/60">
              {days.map((day) => (
                <DayDropZone key={toISODate(day)} id={toISODate(day)} today={isTodayDate(day)} />
              ))}
            </div>
            <div
              className="relative grid grid-cols-7 content-start gap-y-1 py-1.5"
              style={{ gridTemplateRows: `repeat(${laneCount}, minmax(1.25rem, auto))`, minHeight: '8rem' }}
            >
              {bars.map((bar) => (
                <DraggableTaskBar
                  key={`${bar.task.id}-${bar.startCol}-${bar.endCol}`}
                  bar={bar}
                  lane={laneOf.get(`${bar.task.id}-${bar.startCol}-${bar.endCol}`) ?? 0}
                  onTaskClick={onTaskClick}
                />
              ))}
            </div>
          </div>
        </DndContext>

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {expanded ? 'Свернуть' : `Показать ещё ${hiddenCount} задач`}
          </button>
        )}

        {expanded && (
          <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-2 text-sm font-medium text-slate-500">Все задачи недели</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sortedTasks.map((t) => (
                <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
