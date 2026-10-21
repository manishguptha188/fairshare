import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { TextField } from '../components/TextField.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) return <Navigate to="/groups" replace />;

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await login(form);
      navigate(location.state?.from ?? '/groups', { replace: true });
    } catch (err) {
      setError(err);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Log in to FairShare</h1>
        {error && (
          <p className="form-error" role="alert">
            {error.message}
          </p>
        )}
        <TextField label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} error={error?.fields?.email} required />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={update}
          error={error?.fields?.password}
          required
        />
        <button type="submit" className="button" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </button>
        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
