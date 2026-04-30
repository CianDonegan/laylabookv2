import type { Service } from '../../types'
import { isValidName, isValidEmail, isValidPhone, isValidTimeRange } from '../../utils/validators'

export interface WaitlistJoinFormState {
  name:          string
  email:         string
  phone:         string
  earliestTime:  string
  latestTime:    string
}

interface WaitlistJoinFormProps {
  form:     WaitlistJoinFormState
  onChange: (form: WaitlistJoinFormState) => void
  onSubmit: () => void
  onCancel: () => void
  loading:  boolean
  error:    string | null
  summary: {
    primaryService: Service
    addons:         Service[]
    dateLabel:      string
    duration:       number
    totalPrice:     string
  }
}

function formatPrice(price: string) {
  const numericPrice = Number(price)
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(numericPrice) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numericPrice)
}

export default function WaitlistJoinForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  loading,
  error,
  summary,
}: WaitlistJoinFormProps) {
  const nameStarted     = form.name.length > 0
  const emailStarted    = form.email.length > 0
  const phoneStarted    = form.phone.length > 0
  const rangeStarted    = form.earliestTime.length > 0 && form.latestTime.length > 0
  const nameValid       = isValidName(form.name)
  const emailValid      = isValidEmail(form.email)
  const phoneValid      = isValidPhone(form.phone)
  const rangeValid      = isValidTimeRange(form.earliestTime, form.latestTime)
  const isValid         = nameValid && emailValid && phoneValid && rangeValid

  return (
    <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-brand-border/70 bg-white shadow-[0_10px_30px_rgba(44,44,44,0.04)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#edf0ea] px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8fa17f] text-xs font-semibold text-white">
            ⏰
          </span>
          <div>
            <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8fa17f]">
              Waitlist
            </p>
            <h2 className="text-sm font-semibold text-brand-text">Join the waitlist for this date</h2>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="rounded-full border border-[#dfe6da] px-3 py-1 text-xs font-semibold text-[#7f9670] transition-colors hover:bg-[#f4f7f1]"
        >
          Close
        </button>
      </div>

      <div className="bg-[#fbfcfa] px-5 py-4 sm:px-6">
        <p className="mb-5 text-xs leading-relaxed text-brand-muted">
          Tell us your preferred time window. We'll email you the moment a slot opens up that fits — you'll have 15 minutes to claim it.
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="waitlist-earliest" className="mb-1.5 block text-xs font-semibold text-brand-text">
              Earliest time
            </label>
            <input
              id="waitlist-earliest"
              name="earliestTime"
              type="time"
              value={form.earliestTime}
              onChange={(e) => onChange({ ...form, earliestTime: e.target.value })}
              className="w-full rounded-2xl border border-[#dfe6da] bg-white px-4 py-3 text-sm text-brand-text shadow-[0_1px_0_rgba(44,44,44,0.02)] transition-all focus:border-[#8fa17f] focus:outline-none focus:ring-2 focus:ring-[#8fa17f]/20"
            />
          </div>
          <div>
            <label htmlFor="waitlist-latest" className="mb-1.5 block text-xs font-semibold text-brand-text">
              Latest time
            </label>
            <input
              id="waitlist-latest"
              name="latestTime"
              type="time"
              value={form.latestTime}
              onChange={(e) => onChange({ ...form, latestTime: e.target.value })}
              className="w-full rounded-2xl border border-[#dfe6da] bg-white px-4 py-3 text-sm text-brand-text shadow-[0_1px_0_rgba(44,44,44,0.02)] transition-all focus:border-[#8fa17f] focus:outline-none focus:ring-2 focus:ring-[#8fa17f]/20"
            />
          </div>
        </div>
        {rangeStarted && !rangeValid && (
          <p className="mb-3 text-xs font-medium text-red-500">
            Latest time must be after earliest time.
          </p>
        )}

        <div className="mb-5 grid gap-4">
          <div>
            <label htmlFor="waitlist-name" className="mb-1.5 block text-xs font-semibold text-brand-text">
              Name
            </label>
            <input
              id="waitlist-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              className="w-full rounded-2xl border border-[#dfe6da] bg-white px-4 py-3 text-sm text-brand-text shadow-[0_1px_0_rgba(44,44,44,0.02)] transition-all placeholder:text-[#b8bdb4] focus:border-[#8fa17f] focus:outline-none focus:ring-2 focus:ring-[#8fa17f]/20"
            />
            {nameStarted && !nameValid && (
              <p className="mt-1.5 text-xs font-medium text-red-500">
                Please enter at least 2 characters.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="waitlist-email" className="mb-1.5 block text-xs font-semibold text-brand-text">
              Email address
            </label>
            <input
              id="waitlist-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => onChange({ ...form, email: e.target.value })}
              className="w-full rounded-2xl border border-[#dfe6da] bg-white px-4 py-3 text-sm text-brand-text shadow-[0_1px_0_rgba(44,44,44,0.02)] transition-all placeholder:text-[#b8bdb4] focus:border-[#8fa17f] focus:outline-none focus:ring-2 focus:ring-[#8fa17f]/20"
            />
            {emailStarted && !emailValid && (
              <p className="mt-1.5 text-xs font-medium text-red-500">
                Please enter a valid email address.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="waitlist-phone" className="mb-1.5 block text-xs font-semibold text-brand-text">
              Phone number
            </label>
            <input
              id="waitlist-phone"
              name="tel"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="08xxxxxxxx, +353xxxxxxxx or +44xxxxxxxxxx"
              value={form.phone}
              onChange={(e) => onChange({ ...form, phone: e.target.value })}
              className="w-full rounded-2xl border border-[#dfe6da] bg-white px-4 py-3 text-sm text-brand-text shadow-[0_1px_0_rgba(44,44,44,0.02)] transition-all placeholder:text-[#b8bdb4] focus:border-[#8fa17f] focus:outline-none focus:ring-2 focus:ring-[#8fa17f]/20"
            />
            <p className={`mt-1.5 text-xs ${phoneStarted && !phoneValid ? 'text-red-500' : 'text-brand-muted'}`}>
              Irish numbers starting with 08 or +353, or UK numbers starting with +44.
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-[#cfdcc8] bg-[#f1f6ee] p-4 shadow-[inset_0_0_0_1px_rgba(143,161,127,0.08)]">
          <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7f9670]">
            What you'd be booking
          </p>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-[#dfe6da] pb-3">
              <span className="text-brand-muted">Service</span>
              <span className="max-w-[65%] text-right font-semibold text-brand-text">
                {summary.primaryService.name}
              </span>
            </div>
            {summary.addons.length > 0 && (
              <div className="flex justify-between gap-4 border-b border-[#dfe6da] pb-3">
                <span className="text-brand-muted">Add-on</span>
                <div className="max-w-[65%] text-right">
                  <p className="font-semibold text-brand-text">Add-ons</p>
                  <div className="mt-1 grid gap-1">
                    {summary.addons.map((a) => (
                      <span key={a.id} className="text-xs leading-relaxed text-brand-muted">
                        {a.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-brand-muted">Date</span>
              <span className="font-medium text-brand-text">{summary.dateLabel}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-brand-muted">Duration</span>
              <span className="font-medium text-brand-text">{summary.duration} min</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-4 rounded-2xl bg-white px-3.5 py-3">
              <span className="text-sm font-semibold text-brand-text">Total</span>
              <span className="text-lg font-semibold text-[#6f875f]">
                {formatPrice(summary.totalPrice)}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-center text-xs font-medium text-red-600">
            {error}
          </p>
        )}

        <button
          onClick={onSubmit}
          disabled={!isValid || loading}
          className="w-full rounded-2xl border py-4 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa17f] focus-visible:ring-offset-2 disabled:cursor-not-allowed"
          style={{
            background:  !isValid || loading ? '#eef0eb' : '#6f875f',
            borderColor: !isValid || loading ? '#dfe6da' : '#6f875f',
            color:       !isValid || loading ? '#8d9588' : '#fff',
            boxShadow:   !isValid || loading ? 'none'    : '0 10px 24px rgba(111,135,95,0.22)',
          }}
        >
          {loading ? 'Joining...' : 'Join waitlist'}
        </button>
      </div>
    </div>
  )
}
