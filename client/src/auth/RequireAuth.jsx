import { Navigate, useLocation } from 'react-router';
import { Loading } from '../components/States.jsx';
import { useAuth } from './AuthContext.jsx';

// Wraps the pages that need a login. Remembering where the user was going lets the login page send them
// back there afterwards. The server still checks every request; this only decides what to show.
export function RequireAuth({ children }) {
  const { user, isChecking } = useAuth();
  const location = useLocation();

  if (isChecking) return <Loading label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
