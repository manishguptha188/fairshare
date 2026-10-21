import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { TextField } from '../components/TextField.jsx';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) return <Navigate to="/groups" replace />;

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await register(form);
      navigate('/groups', { replace: true });
    } catch (err) {
      setError(err);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Create your account</h1>
        {error && (
          <p className="form-error" role="alert">
            {error.message}
          </p>
        )}
        <TextField label="Your name" name="name" autoComplete="name" value={form.name} onChange={update} error={error?.fields?.name} required />
        <TextField label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} error={error?.fields?.email} required />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={update}
          error={error?.fields?.password}
          hint="At least 8 characters."
          required
        />
        <button type="submit" className="button" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}
