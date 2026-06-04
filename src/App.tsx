import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryProvider } from './providers/QueryProvider';
import { AuthProvider } from './context/AuthContext';
import { DBProvider } from './store';
import { ProtectedRoute } from './router/ProtectedRoute';
import { PublicRoute } from './router/PublicRoute';
import { ROUTES } from './router/routes';
import AppLayout from './components/layout/AppLayout';

import Auth        from './pages/Auth';
import Dashboard   from './pages/Dashboard';
import Missions    from './pages/Missions';
import Facturation from './pages/Facturation';
import Encaissements from './pages/Encaissements';
import Salaires    from './pages/Salaires';
import Charges     from './pages/Charges';
import Depenses    from './pages/Depenses';
import PetiteCaisse from './pages/PetiteCaisse';
import Tresorerie  from './pages/Tresorerie';
import BFR         from './pages/BFR';
import TVA         from './pages/TVA';
import Parametres  from './pages/Parametres';
import FNE         from './pages/FNE';

export default function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <DBProvider>
          <BrowserRouter>
            <Routes>

              {/* ── Public ── */}
              <Route
                path={ROUTES.LOGIN}
                element={
                  <PublicRoute>
                    <Auth />
                  </PublicRoute>
                }
              />

              {/* ── Protected ── */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path={ROUTES.DASHBOARD}    element={<Dashboard />} />
                  <Route path={ROUTES.MISSIONS}     element={<Missions />} />
                  <Route path={ROUTES.FACTURATION}  element={<Facturation />} />
                  <Route path={ROUTES.ENCAISSEMENTS} element={<Encaissements />} />
                  <Route path={ROUTES.SALAIRES}     element={<Salaires />} />
                  <Route path={ROUTES.CHARGES}      element={<Charges />} />
                  <Route path={ROUTES.DEPENSES}     element={<Depenses />} />
                  <Route path={ROUTES.PETITE_CAISSE} element={<PetiteCaisse />} />
                  <Route path={ROUTES.TRESORERIE}   element={<Tresorerie />} />
                  <Route path={ROUTES.BFR}          element={<BFR />} />
                  <Route path={ROUTES.TVA}          element={<TVA />} />
                  <Route path={ROUTES.PARAMETRES}   element={<Parametres />} />
                  <Route path={ROUTES.FNE}          element={<FNE />} />
                </Route>
              </Route>

              {/* ── Fallback ── */}
              <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
              <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />

            </Routes>
          </BrowserRouter>
        </DBProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
