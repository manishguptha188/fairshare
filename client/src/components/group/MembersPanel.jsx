import { useState } from 'react';
import { TextField } from '../TextField.jsx';

export function MembersPanel({ members, currentUserId, onAddMember }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [addedName, setAddedName] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setAddedName(null);
    try {
      const member = await onAddMember(email);
      setAddedName(member.name);
      setEmail('');
    } catch (err) {
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card" aria-labelledby="members-title">
      <h2 id="members-title">Members</h2>
      <ul className="member-list">
        {members.map((member) => (
          <li key={member.id}>
            {member.name}
            {member.id === currentUserId && <span className="muted"> (you)</span>}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} noValidate>
        {addedName && (
          <p className="form-success" role="status">
            Added {addedName}.
          </p>
        )}
        <TextField
          label="Add someone by email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error?.message}
          hint="They need a FairShare account first."
          placeholder="friend@example.com"
        />
        <button type="submit" className="button button-secondary" disabled={isSubmitting || !email.trim()}>
          {isSubmitting ? 'Adding…' : 'Add member'}
        </button>
      </form>
    </section>
  );
}
