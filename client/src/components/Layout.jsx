import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState(null);

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      setLogoutError(err.message);
    }
  }

  return (
    <>
      <header className="topbar">
        <Link to="/groups" className="brand">
          FairShare
        </Link>
        <div className="topbar-user">
          <span>{user.name}</span>
          <button type="button" className="button button-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      {logoutError && (
        <p className="banner banner-error" role="alert">
          {logoutError}
        </p>
      )}
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
