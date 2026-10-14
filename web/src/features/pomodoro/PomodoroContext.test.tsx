// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PomodoroProvider, usePomodoroState } from './PomodoroContext';

function Probe({ onValue }: { onValue: (v: ReturnType<typeof usePomodoroState>) => void }) {
  const v = usePomodoroState();
  onValue(v);
  return null;
}

describe('PomodoroProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('таймер не сбрасывается при скрытии виджета', async () => {
    let current: ReturnType<typeof usePomodoroState> | null = null;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={qc}>
        <PomodoroProvider>
          <Probe onValue={(v) => (current = v)} />
        </PomodoroProvider>
      </QueryClientProvider>,
    );

    // ждём загрузку настроек (25 мин из seed)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // старт без задачи
    await act(async () => {
      await current!.start(undefined, 'work');
    });
    expect(current!.state.status).toBe('running');

    // тикаем 10 секунд
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    const beforeHide = current!.state.status !== 'idle' ? current!.state.remainingSec : -1;
    expect(beforeHide).toBeGreaterThan(0);
    expect(beforeHide).toBeLessThan(25 * 60);

    // скрываем виджет
    await act(async () => {
      current!.setIsOpen(false);
    });

    // ещё 5 секунд
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    // таймер должен продолжать идти, а не сброситься
    expect(current!.state.status).toBe('running');
    const afterHide = current!.state.status !== 'idle' ? current!.state.remainingSec : -1;
    expect(afterHide).toBe(beforeHide - 5);
  });

  it('таймер переживает перезагрузку страницы (localStorage)', async () => {
    let current: ReturnType<typeof usePomodoroState> | null = null;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const view = render(
      <QueryClientProvider client={qc}>
        <PomodoroProvider>
          <Probe onValue={(v) => (current = v)} />
        </PomodoroProvider>
      </QueryClientProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await current!.start(undefined, 'work');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    const beforeReload = current!.state.status !== 'idle' ? current!.state.remainingSec : -1;

    // имитируем перезагрузку страницы: размонтируем и монтируем заново
    view.unmount();
    current = null;
    render(
      <QueryClientProvider client={qc}>
        <PomodoroProvider>
          <Probe onValue={(v) => (current = v)} />
        </PomodoroProvider>
      </QueryClientProvider>,
    );

    expect(current!.state.status).toBe('running');
    const afterReload = current!.state.status !== 'idle' ? current!.state.remainingSec : -1;
    expect(afterReload).toBe(beforeReload);
  });
});
