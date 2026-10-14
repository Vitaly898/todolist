import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { PomodoroWidget } from '../../features/pomodoro/PomodoroWidget';

const navItems = [
  { to: '/', label: 'Дашборд', end: true },
  { to: '/tasks', label: 'Задачи', end: false },
  { to: '/settings', label: 'Настройки', end: false },
];

export function AppLayout() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <span className="text-lg font-bold tracking-tight">✅ TODOLIST</span>
          <nav className="flex flex-1 items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggle}
            aria-label="Переключить тему"
            className="rounded-md px-2 py-1.5 text-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <PomodoroWidget />
    </div>
  );
}
