import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { apiRequest } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { BalancesPanel } from '../components/group/BalancesPanel.jsx';
import { ExpenseForm } from '../components/group/ExpenseForm.jsx';
import { ExpenseList } from '../components/group/ExpenseList.jsx';
import { MembersPanel } from '../components/group/MembersPanel.jsx';
import { PaymentsList } from '../components/group/PaymentsList.jsx';
import { ErrorState, Loading } from '../components/States.jsx';
import { useApi } from '../hooks/useApi.js';

export default function GroupPage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [editingExpense, setEditingExpense] = useState(null);

  const base = `/groups/${groupId}`;
  const group = useApi(base);
  const expenses = useApi(`${base}/expenses?page=${page}`);
  const balances = useApi(`${base}/balances`);
  const payments = useApi(`${base}/settlements`);

  if (group.isLoading && !group.data) return <Loading label="Loading the group…" />;
  if (group.error?.status === 404) {
    return (
      <div className="state state-empty">
        <p className="state-title">Group not found</p>
        <p>It may have been removed, or you are not a member.</p>
        <Link to="/groups">Back to your groups</Link>
      </div>
    );
  }
  if (group.error) return <ErrorState error={group.error} onRetry={group.reload} />;

  const members = group.data.group.members;
  // The current user is "You" at the start of a sentence and "you" after a verb ("Ravi paid you").
  const nameOf = (userId, { midSentence = false } = {}) => {
    if (userId === user.id) return midSentence ? 'you' : 'You';
    return members.find((member) => member.id === userId)?.name ?? 'Former member';
  };

  // Any change to money (an expense or a payment) changes the balances too, so both are reloaded together.
  function refreshMoney() {
    expenses.reload();
    balances.reload();
    payments.reload();
  }

  async function saveExpense(payload) {
    if (editingExpense) {
      await apiRequest(`${base}/expenses/${editingExpense.id}`, { method: 'PUT', body: payload });
      setEditingExpense(null);
    } else {
      await apiRequest(`${base}/expenses`, { method: 'POST', body: payload });
      setPage(1);
    }
    refreshMoney();
  }

  return (
    <>
      <p className="breadcrumb">
        <Link to="/groups">← Your groups</Link>
      </p>
      <h1>{group.data.group.name}</h1>

      <div className="group-layout">
        <div className="group-main">
          <ExpenseForm
            // A new key resets the form: when you start editing a different expense, and when the member list
            // changes, so someone who was just added is included in a new equal split.
            key={`${editingExpense?.id ?? 'new'}:${members.map((member) => member.id).join(',')}`}
            members={members}
            currentUserId={user.id}
            expense={editingExpense}
            onSubmit={saveExpense}
            onCancel={() => setEditingExpense(null)}
          />
          <ExpenseList
            result={expenses}
            currentUserId={user.id}
            nameOf={nameOf}
            onPageChange={setPage}
            onEdit={(expense) => {
              setEditingExpense(expense);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onDelete={async (expense) => {
              await apiRequest(`${base}/expenses/${expense.id}`, { method: 'DELETE' });
              // Deleting the only expense on a later page would leave an empty page, so step back one.
              if (page > 1 && expenses.data.expenses.length === 1) setPage(page - 1);
              refreshMoney();
            }}
          />
        </div>

        <aside className="group-side">
          <BalancesPanel
            result={balances}
            currentUserId={user.id}
            nameOf={nameOf}
            onRecordPayment={async (payment) => {
              await apiRequest(`${base}/settlements`, { method: 'POST', body: payment });
              refreshMoney();
            }}
          />
          <MembersPanel
            members={members}
            currentUserId={user.id}
            onAddMember={async (email) => {
              const { member } = await apiRequest(`${base}/members`, { method: 'POST', body: { email } });
              group.reload();
              balances.reload();
              return member;
            }}
          />
          <PaymentsList
            result={payments}
            currentUserId={user.id}
            nameOf={nameOf}
            onDelete={async (payment) => {
              await apiRequest(`${base}/settlements/${payment.id}`, { method: 'DELETE' });
              refreshMoney();
            }}
          />
        </aside>
      </div>
    </>
  );
}
