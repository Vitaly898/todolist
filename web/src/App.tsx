import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { PomodoroProvider } from './features/pomodoro/PomodoroContext';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { TasksPage } from './pages/TasksPage';

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/tasks', element: <TasksPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
]);

export function App() {
  return (
    <PomodoroProvider>
      <RouterProvider router={router} />
    </PomodoroProvider>
  );
}
