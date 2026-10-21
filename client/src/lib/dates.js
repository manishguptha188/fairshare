// Expense dates are calendar days ("2026-10-22"), which the server stores as midnight UTC.
// Showing them in UTC keeps the same day for everyone; showing them in local time would turn
// 22 October into 21 October for anyone west of Greenwich.

// Today's date in the user's own time zone, as the value an <input type="date"> expects.
export function todayInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function dateToInputValue(isoString) {
  return isoString.slice(0, 10);
}

const dayFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function formatDay(isoString) {
  return dayFormat.format(new Date(isoString));
}
