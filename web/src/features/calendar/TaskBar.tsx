import type { Task } from '../../data/types';
import { categoryDot, taskColor } from '../../data/colors';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { CSSProperties, Ref } from 'react';

export interface TaskBarData {
  task: Task;
  startCol: number;
  endCol: number;
  continuesLeft: boolean;
  continuesRight: boolean;
}

interface TaskBarProps {
  bar: TaskBarData;
  lane: number;
  onClick: (task: Task) => void;
  dragRef?: Ref<HTMLButtonElement>;
  dragListeners?: SyntheticListenerMap;
  dragAttributes?: DraggableAttributes;
  dragTransform?: string;
}

const PRIORITY_MARK: Partial<Record<Task['priority'], string>> = {
  3: '❗',
  4: '🔥',
};

/**
 * Полоска задачи от старта до дедлайна (гант-стиль).
 * Цвет полоски — у каждой задачи свой (контрастная палитра по id),
 * точка = сфера, ❗/🔥 = высокий/критический приоритет.
 * Поддерживает DnD (перетаскивание между днями).
 */
export function TaskBar({ bar, lane, onClick, dragRef, dragListeners, dragAttributes, dragTransform }: TaskBarProps) {
  const { task } = bar;
  const isDone = task.status === 'done';

  const style: CSSProperties = {
    gridColumnStart: bar.startCol,
    gridColumnEnd: bar.endCol + 1,
    gridRowStart: lane + 1,
    transform: dragTransform,
  };

  return (
    <button
      type="button"
      ref={dragRef}
      {...(dragListeners ?? {})}
      {...(dragAttributes ?? {})}
      onClick={() => onClick(task)}
      title={`${task.title}${task.estimateHours != null ? ` · ≈${task.estimateHours}ч` : ''}`}
      style={style}
      className={`flex h-5 min-w-0 touch-none items-center gap-1 px-1.5 text-left text-[11px] leading-none text-white ${taskColor(task.id)} ${
        bar.continuesLeft ? 'rounded-l-none' : 'rounded-l-md'
      } ${bar.continuesRight ? 'rounded-r-none' : 'rounded-r-md'} ${
        isDone ? 'opacity-45 line-through' : ''
      } mx-px truncate shadow-sm hover:brightness-110 ${dragTransform ? 'z-20 opacity-80' : ''}`}
    >
      {bar.continuesLeft && <span className="shrink-0 opacity-70">‹</span>}
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-white/70 ${categoryDot[task.category]}`} />
      <span className="truncate">{task.title}</span>
      {PRIORITY_MARK[task.priority] && <span className="shrink-0 text-[9px]">{PRIORITY_MARK[task.priority]}</span>}
      {bar.continuesRight && <span className="ml-auto shrink-0 opacity-70">›</span>}
    </button>
  );
}
