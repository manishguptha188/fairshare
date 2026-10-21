// The API works in whole paise. Typed rupee amounts are converted with string handling, never by
// multiplying a decimal by 100, because 19.99 * 100 is 1998.9999999999998 in JavaScript.

// "1,250.5" -> 125050. Returns null for anything that isn't a positive amount with at most two decimals.
export function toPaise(text) {
  const cleaned = String(text).replace(/[,\s₹]/g, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;

  const [, rupees, fraction = ''] = match;
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
  return paise > 0 ? paise : null;
}

const rupeeFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

// 125050 -> "₹1,250.50". Dividing here is safe: it only affects how the number is shown, not any sum.
export function formatRupees(paise) {
  return rupeeFormat.format(paise / 100);
}

// For pre-filling an input when editing: 125050 -> "1250.50".
export function paiseToInput(paise) {
  return (paise / 100).toFixed(2);
}
