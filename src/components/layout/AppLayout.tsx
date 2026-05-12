import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useTheme';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <>
      <Sidebar user={user!} onLogout={logout} theme={theme} onToggleTheme={toggle} />
      <main className="main">
        <Outlet />
      </main>
    </>
  );
}
