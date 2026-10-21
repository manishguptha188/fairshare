import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BalancesPanel } from './BalancesPanel.jsx';

const names = { ravi: 'Ravi', meera: 'Meera' };
const nameOf = (id, { midSentence = false } = {}) => (id === 'asha' ? (midSentence ? 'you' : 'You') : names[id]);

function renderPanel(data, onRecordPayment = vi.fn().mockResolvedValue()) {
  render(
    <BalancesPanel
      result={{ data, error: null, isLoading: false, reload: vi.fn() }}
      currentUserId="asha"
      nameOf={nameOf}
      onRecordPayment={onRecordPayment}
    />,
  );
  return onRecordPayment;
}

describe('BalancesPanel', () => {
  it('describes each balance in words, with the verb matching the person', () => {
    renderPanel({
      balances: [
        { user: 'asha', amount: 60000 },
        { user: 'ravi', amount: 0 },
        { user: 'meera', amount: -60000 },
      ],
      suggestedPayments: [{ from: 'meera', to: 'asha', amount: 60000 }],
    });

    const list = screen.getAllByRole('list')[0];
    expect(within(list).getByText('get back ₹600.00')).toBeInTheDocument();
    expect(within(list).getByText('settled up')).toBeInTheDocument();
    expect(within(list).getByText('owes ₹600.00')).toBeInTheDocument();
  });

  it("only offers 'Mark as paid' for payments you're part of, and records them", async () => {
    const onRecordPayment = renderPanel({
      balances: [],
      suggestedPayments: [
        { from: 'meera', to: 'asha', amount: 60000 },
        { from: 'meera', to: 'ravi', amount: 20000 },
      ],
    });

    const buttons = screen.getAllByRole('button', { name: 'Mark as paid' });
    expect(buttons).toHaveLength(1);

    await userEvent.setup().click(buttons[0]);
    expect(onRecordPayment).toHaveBeenCalledWith(expect.objectContaining({ from: 'meera', to: 'asha', amount: 60000 }));
    expect(await screen.findByRole('status')).toHaveTextContent('Recorded: Meera paid you ₹600.00.');
  });

  it('says so when everyone is settled', () => {
    renderPanel({ balances: [], suggestedPayments: [] });
    expect(screen.getByText('Everyone is settled up.')).toBeInTheDocument();
  });
});
