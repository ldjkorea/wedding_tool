/** Accept Korean/international display formats, but require an actual dialable number. */
export function isValidPhone(value: string): boolean {
  return /^\+?[\d() -]{8,25}$/.test(value) && /^\d{8,15}$/.test(value.replace(/\D/g, ''));
}
