import { useState } from 'react';
import { todayInputValue } from '../../lib/dates.js';
import { formatRupees } from '../../lib/money.js';
import { ErrorState, Loading } from '../States.jsx';

// The verb follows the name: "You get back", "Ravi gets back".
function describeBalance(amount, isYou) {
  if (amount > 0) return { text: `${isYou ? 'get' : 'gets'} back ${formatRupees(amount)}`, tone: 'positive' };
  if (amount < 0) return { text: `${isYou ? 'owe' : 'owes'} ${formatRupees(-amount)}`, tone: 'negative' };
  return { text: 'settled up', tone: 'neutral' };
}

export function BalancesPanel({ result, currentUserId, nameOf, onRecordPayment }) {
  const { data, error, isLoading, reload } = result;
  const [recordingKey, setRecordingKey] = useState(null);
  const [message, setMessage] = useState(null);

  async function record(payment) {
    const key = `${payment.from}-${payment.to}`;
    setRecordingKey(key);
    setMessage(null);
    try {
      await onRecordPayment({ ...payment, settledAt: todayInputValue() });
      setMessage({
        tone: 'success',
        text: `Recorded: ${nameOf(payment.from)} paid ${nameOf(payment.to, { midSentence: true })} ${formatRupees(payment.amount)}.`,
      });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setRecordingKey(null);
    }
  }

  return (
    <section className="card" aria-labelledby="balances-title">
      <h2 id="balances-title">Balances</h2>
      {isLoading && !data && <Loading label="Working out balances…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <>
          <ul className="balance-list">
            {data.balances.map((balance) => {
              const { text, tone } = describeBalance(balance.amount, balance.user === currentUserId);
              return (
                <li key={balance.user}>
                  <span>{nameOf(balance.user)}</span>
                  <span className={`tone-${tone}`}>{text}</span>
                </li>
              );
            })}
          </ul>

          <h3>Settle up</h3>
          {message && (
            <p className={message.tone === 'error' ? 'form-error' : 'form-success'} role={message.tone === 'error' ? 'alert' : 'status'}>
              {message.text}
            </p>
          )}
          {data.suggestedPayments.length === 0 ? (
            <p className="muted">Everyone is settled up.</p>
          ) : (
            <ul className="payment-suggestions">
              {data.suggestedPayments.map((payment) => {
                const key = `${payment.from}-${payment.to}`;
                const involvesYou = payment.from === currentUserId || payment.to === currentUserId;
                return (
                  <li key={key}>
                    <span>
                      {nameOf(payment.from)} → {nameOf(payment.to)} <strong>{formatRupees(payment.amount)}</strong>
                    </span>
                    {/* The server only accepts payments recorded by the payer or the receiver. */}
                    {involvesYou && (
                      <button type="button" className="button button-small" disabled={recordingKey === key} onClick={() => record(payment)}>
                        {recordingKey === key ? 'Saving…' : 'Mark as paid'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
