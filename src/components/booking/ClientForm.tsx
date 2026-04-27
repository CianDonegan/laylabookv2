import type { Service } from '../../types'

interface ClientFormProps {
  form: { name: string; email: string; phone: string }
  onChange: (form: { name: string; email: string; phone: string }) => void
  onSubmit: () => void
  loading: boolean
  error: string | null
  summary: {
    primaryService: Service
    addons: Service[]
    dateLabel: string
    time: string
    duration: number
    totalPrice: string
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

export default function ClientForm({ form, onChange, onSubmit, loading, error, summary }: ClientFormProps) {
  const cleanPhone = form.phone.replace(/\s/g, '')
  const nameStarted = form.name.length > 0
  const emailStarted = form.email.length > 0
  const phoneStarted = form.phone.length > 0
  const nameValid = form.name.trim().length >= 2
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  const phoneValid = /^(\+353\d{7,9}|0\d{8,9}|\+44\d{10})$/.test(cleanPhone)
  const isValid = nameValid && emailValid && phoneValid

  return (
    <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-brand-border/70 bg-white shadow-[0_10px_30px_rgba(44,44,44,0.04)]">
      <div className="border-b border-[#edf0ea] px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8fa17f] text-xs font-semibold text-white">
            4
          </span>
          <div>
            <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8fa17f]">
              Details
            </p>
            <h2 className="text-sm font-semibold text-brand-text">Your details</h2>
          </div>
        </div>
      </div>

      <div className="bg-[#fbfcfa] px-5 py-4 sm:px-6">
        <div className="mb-5 grid gap-4">
          <div>
            <label htmlFor="client-name" className="mb-1.5 block text-xs font-semibold text-brand-text">
              Name
            </label>
            <input
              id="client-name"
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
            <label htmlFor="client-email" className="mb-1.5 block text-xs font-semibold text-brand-text">
              Email address
            </label>
            <input
              id="client-email"
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
            <label htmlFor="client-phone" className="mb-1.5 block text-xs font-semibold text-brand-text">
              Phone number
            </label>
            <input
              id="client-phone"
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
            Booking summary
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
              <span className="text-brand-muted">Time</span>
              <span className="font-medium text-brand-text">{summary.time}</span>
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
            background: !isValid || loading ? '#eef0eb' : '#6f875f',
            borderColor: !isValid || loading ? '#dfe6da' : '#6f875f',
            color: !isValid || loading ? '#8d9588' : '#fff',
            boxShadow: !isValid || loading ? 'none' : '0 10px 24px rgba(111,135,95,0.22)',
          }}
        >
          {loading ? 'Sending...' : 'Request appointment'}
        </button>
      </div>
    </div>
  )
}
