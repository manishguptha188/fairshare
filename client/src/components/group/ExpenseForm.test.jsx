import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api.js';
import { ExpenseForm } from './ExpenseForm.jsx';

const members = [
  { id: 'a'.repeat(24), name: 'Asha', email: 'asha@example.com' },
  { id: 'b'.repeat(24), name: 'Ravi', email: 'ravi@example.com' },
  { id: 'c'.repeat(24), name: 'Meera', email: 'meera@example.com' },
];
const [asha, ravi, meera] = members;

function renderForm(onSubmit = vi.fn().mockResolvedValue()) {
  render(<ExpenseForm members={members} currentUserId={asha.id} onSubmit={onSubmit} />);
  return { user: userEvent.setup(), onSubmit };
}

describe('ExpenseForm', () => {
  it('sends an equal split in paise, with everyone ticked by default', async () => {
    const { user, onSubmit } = renderForm();

    await user.type(screen.getByLabelText('Description'), 'Groceries');
    await user.type(screen.getByLabelText('Amount (₹)'), '1,000.50');
    await user.click(screen.getByLabelText('Meera'));
    await user.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Groceries',
        amount: 100050,
        paidBy: asha.id,
        splitType: 'equal',
        participants: [asha.id, ravi.id],
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Added “Groceries”.');
  });

  it("explains when exact shares don't add up, without calling the API", async () => {
    const { user, onSubmit } = renderForm();

    await user.type(screen.getByLabelText('Description'), 'Pizza');
    await user.type(screen.getByLabelText('Amount (₹)'), '900');
    await user.click(screen.getByLabelText('By exact amounts'));
    await user.type(screen.getByLabelText('Ravi'), '300');
    await user.type(screen.getByLabelText('Meera'), '500');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(screen.getByText('The shares add up to ₹800.00, not ₹900.00.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('checks the description and amount before sending', async () => {
    const { user, onSubmit } = renderForm();

    await user.type(screen.getByLabelText('Amount (₹)'), '12.345');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(screen.getByText('Describe the expense.')).toBeInTheDocument();
    expect(screen.getByText('Enter an amount like 250 or 250.50.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the server's message when saving fails, and keeps what was typed", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(400, 'The payer must be a member of this group.', { paidBy: 'Not a member.' }));
    const { user } = renderForm(onSubmit);

    await user.type(screen.getByLabelText('Description'), 'Cab');
    await user.type(screen.getByLabelText('Amount (₹)'), '450');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The payer must be a member of this group.');
    expect(screen.getByLabelText('Description')).toHaveValue('Cab');
  });

  it('fills in an existing expense for editing', () => {
    const expense = {
      id: 'e'.repeat(24),
      description: 'Rent',
      amount: 1500000,
      paidBy: ravi.id,
      splitType: 'exact',
      shares: [
        { user: ravi.id, amount: 500000 },
        { user: meera.id, amount: 1000000 },
      ],
      spentAt: '2026-10-01T00:00:00.000Z',
    };
    render(<ExpenseForm members={members} currentUserId={asha.id} expense={expense} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Edit expense' })).toBeInTheDocument();
    expect(screen.getByLabelText('Amount (₹)')).toHaveValue('15000.00');
    expect(screen.getByLabelText('Meera')).toHaveValue('10000.00');
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-01');
  });
});
