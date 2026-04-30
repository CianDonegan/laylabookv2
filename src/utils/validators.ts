// Shared form validators. Extracted from ClientForm.tsx so the booking
// form and the waitlist form share the same rules — change once, both
// forms agree. ClientForm itself still uses inline expressions (left in
// place to avoid disturbing its test suite); migrate when convenient.

export function isValidName(name: string): boolean {
  return name.trim().length >= 2
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function isValidPhone(phone: string): boolean {
  const cleanPhone = phone.replace(/\s/g, '')
  return /^(\+353\d{7,9}|0\d{8,9}|\+44\d{10})$/.test(cleanPhone)
}

// HH:MM 24h. String comparison works because all components are
// zero-padded fixed-width.
export function isValidTimeRange(earliest: string, latest: string): boolean {
  const timeRe = /^\d{2}:\d{2}$/
  if (!timeRe.test(earliest) || !timeRe.test(latest)) return false
  return latest > earliest
}
