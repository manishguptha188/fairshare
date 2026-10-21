// The three non-data states every screen needs, so they look and read the same everywhere.

export function Loading({ label = 'Loading…' }) {
  return (
    <p className="state state-loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </p>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <p>{error.message}</p>
      {onRetry && (
        <button type="button" className="button button-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="state state-empty">
      <p className="state-title">{title}</p>
      {children && <p>{children}</p>}
    </div>
  );
}
