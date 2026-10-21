import { useId } from 'react';

// A labelled input with its error message underneath. aria-invalid and aria-describedby let screen readers
// announce the problem when the input gets focus.
export function TextField({ label, error, hint, ...inputProps }) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={error || hint ? messageId : undefined} {...inputProps} />
      {(error || hint) && (
        <p id={messageId} className={error ? 'field-error' : 'field-hint'}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
