import { createContext, useContext, useEffect, useReducer, useCallback, useRef, useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { useTasks } from '../../hooks/useTasks';
import { useCreatePomodoroSession, useFinishPomodoroSession } from '../../hooks/usePomodoro';
import { playBeep } from './sound';

type PomodoroStatus = 'idle' | 'running' | 'paused';

interface BaseState {
  status: PomodoroStatus;
  kind: 'work' | 'break';
  taskId?: string;
  endsAt: number;
  remainingSec: number;
  sessionId?: string;
}

type State = { status: 'idle'; kind: 'work'; endsAt: 0; remainingSec: 0 } | BaseState;

type Action =
  | { type: 'start'; payload: Omit<BaseState, 'status'> }
  | { type: 'pause' }
  | { type: 'resume'; payload: { endsAt: number } }
  | { type: 'stop' }
  | { type: 'tick'; payload: { now: number } }
  | { type: 'complete' };

const initialState: State = { status: 'idle', kind: 'work', endsAt: 0, remainingSec: 0 };
const STORAGE_KEY = 'todolist.pomodoro';

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return { status: 'running', ...action.payload };
    case 'pause':
      return state.status === 'running' ? { ...state, status: 'paused' } : state;
    case 'resume':
      return state.status === 'paused'
        ? { ...state, status: 'running', endsAt: action.payload.endsAt }
        : state;
    case 'stop':
      return initialState;
    case 'tick': {
      if (state.status !== 'running') return state;
      const remaining = Math.max(0, Math.ceil((state.endsAt - action.payload.now) / 1000));
      return { ...state, remainingSec: remaining };
    }
    case 'complete':
      return initialState;
    default:
      return state;
  }
}

/** Восстановить таймер после перезагрузки страницы. */
function loadPersisted(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw) as BaseState;
    if (saved.status !== 'running' && saved.status !== 'paused') return initialState;
    const remaining = Math.max(0, Math.ceil((saved.endsAt - Date.now()) / 1000));
    return { ...saved, remainingSec: saved.status === 'paused' ? saved.remainingSec : remaining };
  } catch {
    return initialState;
  }
}

function persist(state: State) {
  try {
    if (state.status === 'idle') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // ignore
  }
}

interface PomodoroContextValue {
  state: State;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  start: (taskId: string | undefined, kind: 'work' | 'break') => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadPersisted);
  const [isOpen, setIsOpen] = useState(false);
  const { data: settings } = useSettings();
  const { data: tasks } = useTasks();
  const createSession = useCreatePomodoroSession();
  const finishSession = useFinishPomodoroSession();

  const stateRef = useRef(state);
  const settingsRef = useRef(settings);
  const tasksRef = useRef(tasks);
  useEffect(() => {
    stateRef.current = state;
    persist(state);
  }, [state]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const applyWorkCompletion = useCallback(
    async (sessionId: string | undefined, plannedMin: number, _taskId: string | undefined) => {
      if (sessionId) {
        // completeWorkSession: финиш сессии + списание часов в задачу/срез (локально или на бэкенде)
        await finishSession.mutateAsync({ id: sessionId, actualMin: plannedMin });
      }
    },
    [finishSession],
  );

  const startBreak = useCallback(() => {
    const breakMin = settingsRef.current?.pomodoroBreakMin ?? 5;
    const endsAt = Date.now() + breakMin * 60 * 1000;
    dispatch({ type: 'start', payload: { kind: 'break', endsAt, remainingSec: breakMin * 60 } });
  }, []);

  const start = useCallback(
    async (taskId: string | undefined, kind: 'work' | 'break') => {
      if (kind === 'break') {
        startBreak();
        return;
      }
      const workMin = settingsRef.current?.pomodoroWorkMin ?? 25;
      const endsAt = Date.now() + workMin * 60 * 1000;
      let sessionId: string | undefined;
      if (taskId) {
        const session = await createSession.mutateAsync({ taskId, kind: 'work', plannedMin: workMin });
        sessionId = session.id;
      }
      dispatch({
        type: 'start',
        payload: { kind: 'work', taskId, endsAt, remainingSec: workMin * 60, sessionId },
      });
    },
    [createSession, startBreak],
  );

  const pause = useCallback(() => dispatch({ type: 'pause' }), []);
  const stop = useCallback(() => dispatch({ type: 'stop' }), []);
  const resume = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== 'paused') return;
    const endsAt = Date.now() + s.remainingSec * 1000;
    dispatch({ type: 'resume', payload: { endsAt } });
  }, []);

  useEffect(() => {
    if (state.status !== 'running') return;
    const interval = setInterval(() => {
      const now = Date.now();
      dispatch({ type: 'tick', payload: { now } });
      const current = stateRef.current;
      if (current.status === 'running' && current.remainingSec <= 0) {
        clearInterval(interval);
        playBeep();
        if (current.kind === 'work') {
          const plannedMin = settingsRef.current?.pomodoroWorkMin ?? 25;
          applyWorkCompletion(current.sessionId, plannedMin, current.taskId).then(() => {
            startBreak();
          });
        } else {
          dispatch({ type: 'complete' });
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state.status, applyWorkCompletion, startBreak]);

  // Если страницу перезагрузили, когда таймер уже истёк — завершаем его
  useEffect(() => {
    const s = stateRef.current;
    if (s.status === 'running' && s.remainingSec <= 0) {
      if (s.kind === 'work') {
        const plannedMin = settingsRef.current?.pomodoroWorkMin ?? 25;
        applyWorkCompletion(s.sessionId, plannedMin, s.taskId).then(() => startBreak());
      } else {
        dispatch({ type: 'complete' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PomodoroContext.Provider value={{ state, isOpen, setIsOpen, start, pause, resume, stop }}>
      {children}
    </PomodoroContext.Provider>
  );
}

export function usePomodoroState() {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoroState must be used within PomodoroProvider');
  return ctx;
}
