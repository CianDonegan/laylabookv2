import type { Service } from '../../types'

interface ClientFormProps {
  form: { name: string; phone: string }
  onChange: (form: { name: string; phone: string }) => void
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

export default function ClientForm({ form, onChange, onSubmit, loading, error, summary }: ClientFormProps) {
  const cleanPhone = form.phone.replace(/\s/g, '')
  const nameStarted = form.name.length > 0
  const phoneStarted = form.phone.length > 0
  const nameValid = form.name.trim().length >= 2
  const phoneValid = /^(\+353|0)\d{8,9}$/.test(cleanPhone)
  const isValid = nameValid && phoneValid

  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
      <div className="px-6 pt-5 pb-4 border-b border-brand-border">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium bg-brand-sage">
            4
          </span>
          <h2 className="font-medium text-sm text-brand-text">Your details</h2>
        </div>
      </div>

      <div className="p-6">
        <div className="grid gap-4 mb-5">
          <div>
            <label htmlFor="client-name" className="mb-1.5 block text-xs font-medium text-brand-text">
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
              className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none border border-brand-border bg-brand-bg text-brand-text"
            />
            {nameStarted && !nameValid && (
              <p className="mt-1.5 text-xs text-red-500">Please enter at least 2 characters.</p>
            )}
          </div>

          <div>
            <label htmlFor="client-phone" className="mb-1.5 block text-xs font-medium text-brand-text">
              Phone number
            </label>
            <input
              id="client-phone"
              name="tel"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="08xxxxxxxx or +353xxxxxxxxx"
              value={form.phone}
              onChange={(e) => onChange({ ...form, phone: e.target.value })}
              className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none border border-brand-border bg-brand-bg text-brand-text"
            />
            <p className={`mt-1.5 text-xs ${phoneStarted && !phoneValid ? 'text-red-500' : 'text-brand-muted'}`}>
              Use an Irish mobile number, starting with 08 or +353.
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-4 mb-5 bg-brand-sage-light">
          <p className="text-xs uppercase tracking-widest mb-3 text-brand-sage">Summary</p>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-brand-muted">Service</span>
              <span className="text-right text-brand-text">{summary.primaryService.name}</span>
            </div>
            {summary.addons.map((a) => (
              <div key={a.id} className="flex justify-between gap-4">
                <span className="text-brand-muted">Add-on</span>
                <span className="text-right text-brand-text">{a.name}</span>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <span className="text-brand-muted">Date</span>
              <span className="text-brand-text">{summary.dateLabel}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-brand-muted">Time</span>
              <span className="text-brand-text">{summary.time}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-brand-muted">Duration</span>
              <span className="text-brand-text">{summary.duration}min</span>
            </div>
            <div className="flex justify-between gap-4 pt-2 border-t border-brand-border">
              <span className="text-brand-muted">Total</span>
              <span className="font-semibold text-brand-sage">EUR {summary.totalPrice}</span>
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs text-center mb-3">{error}</p>}

        <button
          onClick={onSubmit}
          disabled={!isValid || loading}
          className="w-full py-4 rounded-2xl text-sm font-medium transition-all"
          style={{
            background: !isValid || loading ? '#ebebeb' : '#a8b89a',
            color: !isValid || loading ? '#9a9a9a' : '#fff',
          }}
        >
          {loading ? 'Sending...' : 'Request appointment'}
        </button>
      </div>
    </div>
  )
}
