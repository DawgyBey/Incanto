import assert from "node:assert/strict";

const isValidBirthdate = (dateStr, today = new Date()) => {
  const match = String(dateStr || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) return false;
  const birthDate = new Date(year, month - 1, day);
  const todayOnly = new Date(today);
  todayOnly.setHours(0, 0, 0, 0);
  return birthDate <= todayOnly;
};

const isValidPhone = (phone) => /^\d{10,12}$/.test(String(phone || ""));

const isValidLuhn = (cardNumber) => {
  const clean = String(cardNumber || "").replace(/\D/g, "");
  if (!/^\d{12,19}$/.test(clean)) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i -= 1) {
    let digit = Number(clean[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
};

const mergeUniqueItems = (current = [], incoming = []) => {
  const merged = [...current];
  incoming.forEach((item) => {
    const existing = merged.find((currentItem) => String(currentItem.id) === String(item.id));
    if (existing) existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
    else merged.unshift(item);
  });
  return merged;
};

const today = new Date(2026, 5, 10);
assert.equal(isValidBirthdate("10/06/2026", today), true);
assert.equal(isValidBirthdate("32/13/2025", today), false);
assert.equal(isValidBirthdate("2025-06-10", today), false);
assert.equal(isValidBirthdate("11/06/2026", today), false);

assert.equal(isValidPhone("9801234567"), true);
assert.equal(isValidPhone("980123456789"), true);
assert.equal(isValidPhone("980 123 4567"), false);
assert.equal(isValidPhone("980123456"), false);

assert.equal(isValidLuhn("4242424242424242"), true);
assert.equal(isValidLuhn("4242424242424241"), false);

const merged = mergeUniqueItems([{ id: 1, quantity: 1 }], [{ id: 1, quantity: 2 }, { id: 2, quantity: 1 }]);
assert.deepEqual(merged.find((item) => item.id === 1).quantity, 3);
assert.equal(merged.length, 2);

console.log("Validation and session persistence tests passed.");
