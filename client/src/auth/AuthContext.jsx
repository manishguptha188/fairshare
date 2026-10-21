import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api.js';

const AuthContext = createContext(null);

// Knows who is logged in for the whole app. On first load it asks the server (`/auth/me`), because the
// login cookie is httpOnly: JavaScript can't look at it to find out.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    apiRequest('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setIsChecking(false));
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await apiRequest('/auth/login', { method: 'POST', body: credentials });
    setUser(data.user);
  }, []);

  const register = useCallback(async (details) => {
    const data = await apiRequest('/auth/register', { method: 'POST', body: details });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, isChecking, login, register, logout }), [user, isChecking, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}
