import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from '../repository';
import type { TaskFilters } from '../types';
import { createHttpRepository } from './httpRepository';

const from = '2026-10-01';
const to = '2026-10-31';
const task = {
  id: 'task-1', title: 'Read', status: 'todo', priority: 2, category: 'study',
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
} as const;
const settings = { defaultDailyCapacityHours: 4, pomodoroWorkMin: 25, pomodoroBreakMin: 5 };
const windowInput = { weekday: 1, startMin: 600, endMin: 720 } as const;
const workWindow = { id: 'window-1', ...windowInput };
const capacity = { date: from, capacityHours: 4 };
const sliceInput = { date: from, plannedHours: 2, doneHours: 0, manual: true };
const slice = { id: 'slice-1', taskId: task.id, ...sliceInput };
const sessionInput = { taskId: task.id, kind: 'work', plannedMin: 25 } as const;
const session = { id: 'session-1', startedAt: '2026-10-01T10:00:00Z', ...sessionInput };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

type RequestCase = {
  name: string;
  call: (repository: Repository) => Promise<unknown>;
  path: string;
  method?: string;
  body?: unknown;
  response: unknown;
  expected?: unknown;
};

const requests: RequestCase[] = [
  { name: 'list tasks', call: r => r.listTasks(), path: '/tasks', response: [task] },
  { name: 'get task', call: r => r.getTask(task.id), path: '/tasks/task-1', response: task },
  { name: 'get task with a synthetic null response', call: r => r.getTask('missing'), path: '/tasks/missing', response: null },
  { name: 'create task', call: r => r.createTask({ title: 'Read', description: undefined }), path: '/tasks', method: 'POST', body: { title: 'Read' }, response: task },
  { name: 'update task', call: r => r.updateTask(task.id, { title: 'Updated' }), path: '/tasks/task-1', method: 'PATCH', body: { title: 'Updated' }, response: task },
  { name: 'delete task', call: r => r.deleteTask(task.id), path: '/tasks/task-1', method: 'DELETE', response: { deleted: true }, expected: undefined },
  { name: 'get settings', call: r => r.getSettings(), path: '/settings', response: settings },
  { name: 'update settings', call: r => r.updateSettings({ pomodoroWorkMin: 30 }), path: '/settings', method: 'PUT', body: { pomodoroWorkMin: 30 }, response: settings },
  { name: 'list work windows', call: r => r.listWorkWindows(), path: '/schedule/windows', response: [workWindow] },
  { name: 'set work windows', call: r => r.setWorkWindows([windowInput]), path: '/schedule/windows', method: 'PUT', body: [windowInput], response: [workWindow] },
  { name: 'list capacities', call: r => r.listDayCapacities(from, to), path: `/schedule/capacity?from=${from}&to=${to}`, response: [capacity] },
  { name: 'upsert capacity', call: r => r.upsertDayCapacity(capacity), path: '/schedule/capacity', method: 'PUT', body: capacity, response: capacity, expected: undefined },
  { name: 'list calendar slices', call: r => r.listSlices(from, to), path: `/calendar?from=${from}&to=${to}`, response: { tasks: [task], slices: [slice] }, expected: [slice] },
  { name: 'replace task slices', call: r => r.replaceTaskSlices(task.id, [sliceInput]), path: '/planner/apply', method: 'POST', body: { taskId: task.id, slices: [sliceInput] }, response: [slice] },
  { name: 'list pomodoro sessions', call: r => r.listPomodoroSessions(from, to), path: `/pomodoro/sessions?from=${from}&to=${to}`, response: [session] },
  { name: 'start pomodoro session', call: r => r.createPomodoroSession(sessionInput), path: '/pomodoro/start', method: 'POST', body: sessionInput, response: session },
  { name: 'finish pomodoro session', call: r => r.finishPomodoroSession(session.id, 23), path: '/pomodoro/session-1/finish', method: 'POST', body: { actualMin: 23 }, response: session },
  { name: 'complete work session', call: r => r.completeWorkSession(session.id, 23), path: '/pomodoro/session-1/finish', method: 'POST', body: { actualMin: 23 }, response: session },
];

describe('HTTP repository contract', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let repository: Repository;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    repository = createHttpRepository();
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(requests)('$name preserves URL, method, JSON body and result', async test => {
    fetchMock.mockResolvedValue(jsonResponse(test.response));
    const result = await test.call(repository);
    expect(result).toEqual('expected' in test ? test.expected : test.response);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`/api${test.path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...(test.method ? { method: test.method } : {}),
      ...(test.body !== undefined ? { body: JSON.stringify(test.body) } : {}),
    });
  });

  it.each<{ name: string; filters?: TaskFilters; query: string }>([
    { name: 'absent filters', query: '' },
    { name: 'empty filters', filters: {}, query: '' },
    { name: 'empty arrays and dates', filters: { status: [], priority: [], category: [], from: '', to: '' }, query: '' },
    { name: 'all filters', filters: { status: ['todo', 'in_progress'], priority: [1, 4], category: ['work', 'study'], from, to }, query: '?status=todo%2Cin_progress&priority=1%2C4&category=work%2Cstudy&from=2026-10-01&to=2026-10-31' },
    { name: 'escaped filter values', filters: { from: 'a b&c', to: 'x+y' }, query: '?from=a+b%26c&to=x%2By' },
  ])('$name use existing query serialization', async ({ filters, query }) => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await repository.listTasks(filters);
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/tasks${query}`);
  });

  it.each([
    { name: 'tasks', call: (r: Repository) => r.listTasks(), response: null },
    { name: 'windows', call: (r: Repository) => r.listWorkWindows(), response: null },
    { name: 'capacities', call: (r: Repository) => r.listDayCapacities(from, to), response: null },
    { name: 'sessions', call: (r: Repository) => r.listPomodoroSessions(from, to), response: null },
    { name: 'null calendar slices', call: (r: Repository) => r.listSlices(from, to), response: { slices: null } },
    { name: 'missing calendar slices', call: (r: Repository) => r.listSlices(from, to), response: { tasks: [] } },
  ])('$name fall back to an empty array', async ({ call, response }) => {
    fetchMock.mockResolvedValue(jsonResponse(response));
    expect(await call(repository)).toEqual([]);
  });

  it.each([
    { name: 'task identifier', call: (r: Repository) => r.getTask('a/b?c'), path: '/api/tasks/a/b?c', response: task },
    { name: 'capacity dates', call: (r: Repository) => r.listDayCapacities('a&b', 'c+d'), path: '/api/schedule/capacity?from=a&b&to=c+d', response: [] },
    { name: 'calendar dates', call: (r: Repository) => r.listSlices('a&b', 'c+d'), path: '/api/calendar?from=a&b&to=c+d', response: { slices: [] } },
    { name: 'session dates', call: (r: Repository) => r.listPomodoroSessions('a&b', 'c+d'), path: '/api/pomodoro/sessions?from=a&b&to=c+d', response: [] },
  ])('$name remain interpolated without new URL encoding', async ({ call, path, response }) => {
    fetchMock.mockResolvedValue(jsonResponse(response));
    await call(repository);
    expect(fetchMock.mock.calls[0][0]).toBe(path);
  });

  it('completeWorkSession delegates through the repository method', async () => {
    const finish = vi.spyOn(repository, 'finishPomodoroSession').mockResolvedValue(session);
    expect(await repository.completeWorkSession(session.id, 23)).toEqual(session);
    expect(finish).toHaveBeenCalledExactlyOnceWith(session.id, 23);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('addDoneHoursToSlice returns the existing noop slice without HTTP', async () => {
    expect(await repository.addDoneHoursToSlice(task.id, from, 1.5)).toEqual({
      id: 'noop', taskId: task.id, date: from, plannedHours: 0, doneHours: 1.5,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resetToSeed rejects as unsupported without HTTP', async () => {
    await expect(repository.resetToSeed()).rejects.toThrow('resetToSeed is not supported by HTTP backend');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'server JSON message', response: () => jsonResponse({ error: { message: 'Task is locked' } }, 409), message: 'Task is locked' },
    { name: 'missing server message', response: () => jsonResponse({ error: {} }, 400), message: 'HTTP 400' },
    { name: 'empty server message', response: () => jsonResponse({ error: { message: '' } }, 422), message: 'HTTP 422' },
    { name: 'non-JSON error', response: () => new Response('upstream unavailable', { status: 502 }), message: 'HTTP 502' },
    { name: 'null error body', response: () => jsonResponse(null, 500), message: 'HTTP 500' },
  ])('$name preserves the error message', async ({ response, message }) => {
    fetchMock.mockResolvedValue(response());
    await expect(repository.getSettings()).rejects.toThrow(message);
  });

  it.each([
    { name: 'delete', call: (r: Repository) => r.deleteTask(task.id), expected: undefined },
    { name: 'upsert', call: (r: Repository) => r.upsertDayCapacity(capacity), expected: undefined },
    { name: 'get settings', call: (r: Repository) => r.getSettings(), expected: undefined },
    { name: 'list tasks', call: (r: Repository) => r.listTasks(), expected: [] },
  ])('204 for $name skips JSON parsing', async ({ call, expected }) => {
    const response = new Response(null, { status: 204 });
    const parse = vi.spyOn(response, 'json');
    fetchMock.mockResolvedValue(response);
    expect(await call(repository)).toEqual(expected);
    expect(parse).not.toHaveBeenCalled();
  });

  it('missing task preserves the backend 404 error rather than returning null', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: 'not_found', message: 'task not found' } }, 404));
    await expect(repository.getTask('missing')).rejects.toThrow('task not found');
  });

  it('cyclic payload rejects before sending an HTTP request', async () => {
    const input = { title: 'Read' } as { title: string; self?: unknown };
    input.self = input;
    await expect(repository.createTask(input)).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('network failures propagate the original error without retry', async () => {
    const error = new TypeError('Failed to fetch');
    fetchMock.mockRejectedValue(error);
    await expect(repository.createTask({ title: 'Read' })).rejects.toBe(error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('invalid successful JSON propagates the parse failure', async () => {
    fetchMock.mockResolvedValue(new Response('not JSON', { status: 200 }));
    await expect(repository.getSettings()).rejects.toBeInstanceOf(SyntaxError);
  });
});
