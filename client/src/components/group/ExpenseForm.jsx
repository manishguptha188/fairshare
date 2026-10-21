import { useState } from 'react';
import { dateToInputValue, todayInputValue } from '../../lib/dates.js';
import { formatRupees, paiseToInput, toPaise } from '../../lib/money.js';
import { TextField } from '../TextField.jsx';

function initialValues(expense, members, currentUserId) {
  if (!expense) {
    return {
      description: '',
      amount: '',
      paidBy: currentUserId,
      spentAt: todayInputValue(),
      splitType: 'equal',
      participants: members.map((member) => member.id),
      exactAmounts: {},
    };
  }
  return {
    description: expense.description,
    amount: paiseToInput(expense.amount),
    paidBy: expense.paidBy,
    spentAt: dateToInputValue(expense.spentAt),
    splitType: expense.splitType,
    participants: expense.shares.map((share) => share.user),
    exactAmounts: Object.fromEntries(expense.shares.map((share) => [share.user, paiseToInput(share.amount)])),
  };
}

// Checks what the browser can check, so mistakes show up instantly. The server repeats every check,
// because anyone can call the API without this form.
function validate(values, members) {
  const errors = {};
  if (!values.description.trim()) errors.description = 'Describe the expense.';

  const amount = toPaise(values.amount);
  if (amount === null) errors.amount = 'Enter an amount like 250 or 250.50.';

  const shares = [];
  if (values.splitType === 'equal') {
    if (values.participants.length === 0) errors.shares = 'Choose at least one person to split with.';
  } else {
    for (const member of members) {
      const text = values.exactAmounts[member.id] ?? '';
      if (text.trim() === '') continue;
      const share = toPaise(text);
      if (share === null) {
        errors.shares = `Check ${member.name}'s amount.`;
      } else {
        shares.push({ user: member.id, amount: share });
      }
    }
    const assigned = shares.reduce((sum, share) => sum + share.amount, 0);
    if (!errors.shares && amount !== null && assigned !== amount) {
      errors.shares = `The shares add up to ${formatRupees(assigned)}, not ${formatRupees(amount)}.`;
    }
  }
  return { errors, amount, shares };
}

export function ExpenseForm({ members, currentUserId, expense, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => initialValues(expense, members, currentUserId));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedMessage, setSavedMessage] = useState(null);
  const isEditing = Boolean(expense);

  const set = (field) => (event) => setValues({ ...values, [field]: event.target.value });

  function toggleParticipant(memberId) {
    const participants = values.participants.includes(memberId)
      ? values.participants.filter((id) => id !== memberId)
      : // Keep the group's member order so the leftover paise always go to the same people.
        members.map((member) => member.id).filter((id) => id === memberId || values.participants.includes(id));
    setValues({ ...values, participants });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSavedMessage(null);
    setFormError(null);

    const { errors: found, amount, shares } = validate(values, members);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = {
      description: values.description.trim(),
      amount,
      paidBy: values.paidBy,
      spentAt: values.spentAt,
      splitType: values.splitType,
      ...(values.splitType === 'equal' ? { participants: values.participants } : { shares }),
    };

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
      if (!isEditing) {
        setValues(initialValues(null, members, currentUserId));
        setSavedMessage(`Added “${payload.description}”.`);
      }
    } catch (err) {
      setErrors(err.fields ?? {});
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const exactTotal = Object.values(values.exactAmounts).reduce((sum, text) => sum + (toPaise(text) ?? 0), 0);

  return (
    <form className="card expense-form" onSubmit={handleSubmit} noValidate>
      <h2>{isEditing ? 'Edit expense' : 'Add an expense'}</h2>
      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      {savedMessage && (
        <p className="form-success" role="status">
          {savedMessage}
        </p>
      )}

      <div className="form-row">
        <TextField label="Description" value={values.description} onChange={set('description')} error={errors.description} maxLength={100} placeholder="Groceries, rent, cab…" />
        <TextField label="Amount (₹)" value={values.amount} onChange={set('amount')} error={errors.amount} inputMode="decimal" placeholder="0.00" />
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="paid-by">Paid by</label>
          <select id="paid-by" value={values.paidBy} onChange={set('paidBy')}>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.id === currentUserId ? `You (${member.name})` : member.name}
              </option>
            ))}
          </select>
        </div>
        <TextField label="Date" type="date" value={values.spentAt} onChange={set('spentAt')} error={errors.spentAt} />
      </div>

      <fieldset className="split">
        <legend>Split</legend>
        <div className="split-type">
          {['equal', 'exact'].map((type) => (
            <label key={type}>
              <input type="radio" name="splitType" value={type} checked={values.splitType === type} onChange={set('splitType')} />
              {type === 'equal' ? 'Equally' : 'By exact amounts'}
            </label>
          ))}
        </div>

        {values.splitType === 'equal' ? (
          <ul className="split-people">
            {members.map((member) => (
              <li key={member.id}>
                <label>
                  <input type="checkbox" checked={values.participants.includes(member.id)} onChange={() => toggleParticipant(member.id)} />
                  {member.id === currentUserId ? 'You' : member.name}
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <ul className="split-people">
              {members.map((member) => (
                <li key={member.id} className="exact-share">
                  <label htmlFor={`share-${member.id}`}>{member.id === currentUserId ? 'You' : member.name}</label>
                  <input
                    id={`share-${member.id}`}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={values.exactAmounts[member.id] ?? ''}
                    onChange={(event) => setValues({ ...values, exactAmounts: { ...values.exactAmounts, [member.id]: event.target.value } })}
                  />
                </li>
              ))}
            </ul>
            <p className="muted">
              Assigned {formatRupees(exactTotal)}
              {toPaise(values.amount) !== null && ` of ${formatRupees(toPaise(values.amount))}`}
            </p>
          </>
        )}
        {errors.shares && <p className="field-error">{errors.shares}</p>}
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="button" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Add expense'}
        </button>
        {isEditing && (
          <button type="button" className="button button-secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
