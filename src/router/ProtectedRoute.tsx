import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from './routes';

const ASSISTANTE_ALLOWED = new Set<string>([ROUTES.DASHBOARD, ROUTES.PETITE_CAISSE, ROUTES.PARAMETRES, ROUTES.DEPENSES]);

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} strokeWidth={1.5} color="var(--G)" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--tx3)' }}>Chargement…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (user.role === 'ASSISTANTE' && !ASSISTANTE_ALLOWED.has(location.pathname)) {
    return <Navigate to={ROUTES.PETITE_CAISSE} replace />;
  }

  return <Outlet />;
}
