/** Display mask: (214) ***-1234  — never used as a storage format. */
export function maskE164(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  const last4 = digits.slice(-4);
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    return `(${area}) ***-${last4}`;
  }
  if (digits.length === 10) {
    const area = digits.slice(0, 3);
    return `(${area}) ***-${last4}`;
  }
  return `***${last4}`;
}

export function normalizeE164(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (input.startsWith("+") && digits.length >= 8) return `+${digits}`;
  throw new Error(`Invalid phone number: ${input}`);
}

export function areaCodeFromE164(e164: string): string | undefined {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1, 4);
  if (digits.length === 10) return digits.slice(0, 3);
  return undefined;
}
