/** Shared comparison policy: trim edges, NFC, uppercase; internal spaces are invalid. */
export function normalizePartnerCode(value: string): string { return value.trim().normalize('NFC').toUpperCase(); }
export function isPartnerCodeFormat(value: string): boolean { return /^[\p{L}\p{N}_-]{2,64}$/u.test(value); }
