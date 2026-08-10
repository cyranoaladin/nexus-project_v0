export type NormalizedParentPhone = Readonly<{
  display: string;
  normalized: string;
}>;

const TUNISIA_PREFIX = '216';

export function normalizeParentPhone(value: string): NormalizedParentPhone {
  const input = value.trim();
  if (!input || !/^[\d\s()+.-]+$/.test(input)) throw new Error('PARENT_PHONE_INVALID');

  if (input.startsWith('+') && !input.startsWith('+216')) throw new Error('PARENT_PHONE_INVALID');
  if (input.startsWith('00') && !input.startsWith('00216')) throw new Error('PARENT_PHONE_INVALID');

  let digits = input.replace(/\D/g, '');
  if (digits.startsWith(`00${TUNISIA_PREFIX}`)) digits = digits.slice(5);
  else if (digits.length === 11 && digits.startsWith(TUNISIA_PREFIX)) digits = digits.slice(3);

  if (!/^[1-9]\d{7}$/.test(digits)) throw new Error('PARENT_PHONE_INVALID');

  return Object.freeze({
    display: digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim(),
    normalized: digits,
  });
}
