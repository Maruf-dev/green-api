/**
 * Нормализация номера телефона к формату GREEN-API MAX.
 *
 * Метод CheckAccount принимает 11 или 12 цифр и поддерживает
 * только номера РФ (код 7) и РБ (код 375).
 */

/** Оставляет только цифры и добавляет код РФ, если введено 10 цифр. */
export function normalizePhone(input) {
  if (!input) return '';
  let digits = String(input).replace(/\D/g, '');

  // 8XXXXXXXXXX -> 7XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = '7' + digits.slice(1);
  }
  // 10 цифр без кода страны
  if (digits.length === 10) {
    digits = '7' + digits;
  }
  return digits;
}

/** Проверяет, что номер подходит для CheckAccount (РФ или РБ). */
export function isValidPhone(digits) {
  return /^(7\d{10}|375\d{9})$/.test(digits);
}

/** Человекочитаемое представление номера. */
export function formatPhone(digits) {
  if (!digits) return '';
  if (/^7\d{10}$/.test(digits)) {
    const d = digits.slice(1);
    return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
  }
  if (/^375\d{9}$/.test(digits)) {
    const d = digits.slice(3);
    return `+375 ${d.slice(0, 2)} ${d.slice(2, 5)}-${d.slice(5, 7)}-${d.slice(7)}`;
  }
  return `+${digits}`;
}
