import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Task, TaskStatus } from '../../data/types';
import { STATUS_LABELS } from '../../data/types';
import { useUpdateTask } from '../../hooks/useTasks';
import { TaskCard } from './TaskCard';

interface TaskBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];

const columnStyles: Record<TaskStatus, string> = {
  todo: 'bg-slate-100 dark:bg-slate-900',
  in_progress: 'bg-sky-50 dark:bg-sky-950/30',
  done: 'bg-emerald-50 dark:bg-emerald-950/30',
  cancelled: 'bg-slate-50 dark:bg-slate-900/50',
};

function BoardColumn({
  status,
  children,
}: {
  status: TaskStatus;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-40 rounded-lg p-2 transition-colors ${columnStyles[status]} ${
        isOver ? 'ring-2 ring-slate-400 dark:ring-slate-500' : ''
      }`}
    >
      {children}
    </div>
  );
}

function DraggableTaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  return (
    <TaskCard
      task={task}
      onClick={onClick}
      dragRef={setNodeRef}
      dragListeners={listeners}
      dragAttributes={attributes}
      dragTransform={transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined}
    />
  );
}

/** Kanban-доска: колонки по статусам, DnD меняет статус задачи (PLAN.md фаза 6). */
export function TaskBoard({ tasks, onTaskClick }: TaskBoardProps) {
  const updateTask = useUpdateTask();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const newStatus = String(over.id) as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    updateTask.mutate({ id: taskId, patch: { status: newStatus } });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((status) => {
          const columnTasks = tasks.filter((t) => t.status === status);
          return (
            <BoardColumn key={status} status={status}>
              <h3 className="mb-2 px-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {STATUS_LABELS[status]} · {columnTasks.length}
              </h3>
              <div className="flex flex-col gap-2">
                {columnTasks.map((t) => (
                  <DraggableTaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} />
                ))}
                {columnTasks.length === 0 && (
                  <p className="rounded border border-dashed border-slate-300 p-3 text-center text-xs text-slate-400 dark:border-slate-700">
                    Перетащите задачу сюда
                  </p>
                )}
              </div>
            </BoardColumn>
          );
        })}
      </div>
    </DndContext>
  );
}
