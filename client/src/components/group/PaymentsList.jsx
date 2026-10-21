import { useState } from 'react';
import { formatDay } from '../../lib/dates.js';
import { formatRupees } from '../../lib/money.js';
import { ErrorState, Loading } from '../States.jsx';

export function PaymentsList({ result, currentUserId, nameOf, onDelete }) {
  const { data, error, isLoading, reload } = result;
  const [actionError, setActionError] = useState(null);

  async function handleDelete(payment) {
    if (!window.confirm('Delete this payment? The balances will go back to before it was recorded.')) return;
    setActionError(null);
    try {
      await onDelete(payment);
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <section className="card" aria-labelledby="payments-title">
      <h2 id="payments-title">Payments</h2>
      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      {isLoading && !data && <Loading label="Loading payments…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.settlements.length === 0 && <p className="muted">No payments recorded yet.</p>}
      {data && data.settlements.length > 0 && (
        <ul className="payment-list">
          {data.settlements.map((payment) => (
            <li key={payment.id}>
              <span>
                {nameOf(payment.from)} paid {nameOf(payment.to, { midSentence: true })} <strong>{formatRupees(payment.amount)}</strong>
                <span className="muted"> · {formatDay(payment.settledAt)}</span>
              </span>
              {payment.createdBy === currentUserId && (
                <button type="button" className="button-link danger" onClick={() => handleDelete(payment)}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
