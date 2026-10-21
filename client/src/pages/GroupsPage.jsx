import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { apiRequest } from '../api.js';
import { EmptyState, ErrorState, Loading } from '../components/States.jsx';
import { TextField } from '../components/TextField.jsx';
import { useApi } from '../hooks/useApi.js';

export default function GroupsPage() {
  const { data, error, isLoading, reload } = useApi('/groups');

  return (
    <>
      <h1>Your groups</h1>
      <div className="groups-layout">
        <section aria-labelledby="group-list-title">
          <h2 id="group-list-title" className="visually-hidden">
            Group list
          </h2>
          {isLoading && !data && <Loading label="Loading your groups…" />}
          {error && <ErrorState error={error} onRetry={reload} />}
          {data && data.groups.length === 0 && (
            <EmptyState title="No groups yet">Create one for your flat, your next trip or anything you share costs for.</EmptyState>
          )}
          {data && data.groups.length > 0 && (
            <ul className="group-list">
              {data.groups.map((group) => (
                <li key={group.id}>
                  <Link to={`/groups/${group.id}`} className="card group-card">
                    <span className="group-card-name">{group.name}</span>
                    <span className="muted">
                      {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <CreateGroupForm />
      </div>
    </>
  );
}

function CreateGroupForm() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const { group } = await apiRequest('/groups', { method: 'POST', body: { name } });
      // A new group is only useful once people are in it, so go straight there to add them.
      navigate(`/groups/${group.id}`);
    } catch (err) {
      setError(err);
      setIsSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h2>New group</h2>
      <TextField
        label="Group name"
        placeholder="Flat 4B, Goa trip…"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={error?.fields?.name ?? error?.message}
        maxLength={60}
        required
      />
      <button type="submit" className="button" disabled={isSubmitting}>
        {isSubmitting ? 'Creating…' : 'Create group'}
      </button>
    </form>
  );
}
