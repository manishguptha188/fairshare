import { useState } from 'react';
import { formatDay } from '../../lib/dates.js';
import { formatRupees } from '../../lib/money.js';
import { EmptyState, ErrorState, Loading } from '../States.jsx';

// "You lent ₹666.67" / "You owe ₹333.33" / "Not involved": what this expense means for the current user.
function yourPart(expense, currentUserId) {
  const yourShare = expense.shares.find((share) => share.user === currentUserId)?.amount ?? 0;
  if (expense.paidBy === currentUserId) {
    const lent = expense.amount - yourShare;
    return lent > 0 ? { text: `You lent ${formatRupees(lent)}`, tone: 'positive' } : { text: 'Only you', tone: 'neutral' };
  }
  return yourShare > 0 ? { text: `You owe ${formatRupees(yourShare)}`, tone: 'negative' } : { text: 'Not involved', tone: 'neutral' };
}

export function ExpenseList({ result, currentUserId, nameOf, onPageChange, onEdit, onDelete }) {
  const { data, error, isLoading, reload } = result;
  const [actionError, setActionError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function handleDelete(expense) {
    if (!window.confirm(`Delete “${expense.description}”? This also changes everyone's balances.`)) return;
    setActionError(null);
    setDeletingId(expense.id);
    try {
      await onDelete(expense);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="card" aria-labelledby="expenses-title">
      <h2 id="expenses-title">Expenses</h2>
      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      {isLoading && !data && <Loading label="Loading expenses…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.total === 0 && <EmptyState title="No expenses yet">Add the first one with the form above.</EmptyState>}

      {data && data.expenses.length > 0 && (
        <ul className={`expense-list${isLoading ? ' is-refreshing' : ''}`}>
          {data.expenses.map((expense) => {
            const part = yourPart(expense, currentUserId);
            const people = expense.shares.length;
            return (
              <li key={expense.id} className="expense">
                <div className="expense-main">
                  <span className="expense-description">{expense.description}</span>
                  <span className="muted">
                    {formatDay(expense.spentAt)} · {nameOf(expense.paidBy)} paid · {expense.splitType === 'equal' ? 'split equally' : 'exact split'} between {people}
                  </span>
                </div>
                <div className="expense-amounts">
                  <span className="expense-amount">{formatRupees(expense.amount)}</span>
                  <span className={`tone-${part.tone}`}>{part.text}</span>
                </div>
                {expense.createdBy === currentUserId && (
                  <div className="expense-actions">
                    <button type="button" className="button-link" onClick={() => onEdit(expense)}>
                      Edit
                    </button>
                    <button type="button" className="button-link danger" onClick={() => handleDelete(expense)} disabled={deletingId === expense.id}>
                      {deletingId === expense.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data && data.totalPages > 1 && (
        <nav className="pagination" aria-label="Expense pages">
          <button type="button" className="button button-secondary" disabled={data.page <= 1} onClick={() => onPageChange(data.page - 1)}>
            Newer
          </button>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <button type="button" className="button button-secondary" disabled={data.page >= data.totalPages} onClick={() => onPageChange(data.page + 1)}>
            Older
          </button>
        </nav>
      )}
    </section>
  );
}
