import { useState } from 'react'

const POLICIES: [string, string][] = [
  ['Payment', 'Cash only. Please bring exact change.'],
  ['Refills', "Refills over other artists' nails or lash work are not offered."],
  ['Punctuality', 'Late arrivals over 10 mins may result in a shortened service or rescheduling.'],
  ['Cancellations', '24 hours notice required for all cancellations.'],
  ['Confirmations', 'A confirmation email will be sent when your booking is accepted.'],
  ['No-Shows', 'Clients who do not attend without notice will be unable to book future appointments.'],
  ['Patch Testing', 'Required for waxing and tinting services. Please schedule in advance.'],
  ['Media Consent', 'Photos or videos taken may be posted to social media. Let me know if you do not consent.'],
  ['Location', 'Clondalkin, D22.'],
  ['Entry Protocol', 'Text when you arrive outside and I will come to let you in.'],
]

const KEY_POLICIES = POLICIES.slice(0, 4)

interface PolicyCardProps {
  onAccept: () => void
}

export default function PolicyCard({ onAccept }: PolicyCardProps) {
  const [accepted, setAccepted] = useState(false)

  const handleAccept = () => {
    setAccepted(true)
    onAccept()
  }

  return (
    <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-brand-border/70 bg-white shadow-[0_10px_30px_rgba(44,44,44,0.04)]">
      <div className="px-5 pt-5 pb-4 sm:px-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8fa17f]">
              Required
            </p>
            <h2 className="text-sm font-semibold text-brand-text">Booking Policy</h2>
          </div>
          <span className="rounded-full bg-[#eef3ea] px-3 py-1 text-[0.68rem] font-semibold text-[#7f9670]">
            Review
          </span>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-brand-muted">
          Please review the key booking policies before continuing.
        </p>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {KEY_POLICIES.map(([title, text]) => (
            <div
              key={title}
              className="rounded-2xl border border-[#edf0ea] bg-[#fbfcfa] px-3.5 py-3"
            >
              <h3 className="text-xs font-semibold text-brand-text">{title}</h3>
              <p className="mt-1 text-[0.72rem] leading-relaxed text-brand-muted">{text}</p>
            </div>
          ))}
        </div>

        <details className="group mt-3 rounded-2xl border border-[#edf0ea] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-xs font-semibold text-brand-text marker:hidden">
            <span>View all policy details</span>
            <span className="text-[0.68rem] font-semibold text-[#8fa17f] transition group-open:rotate-180">
              v
            </span>
          </summary>
          <div className="border-t border-[#edf0ea] px-3.5 pb-3 text-xs text-brand-muted">
            {POLICIES.map(([title, text]) => (
              <div
                key={title}
                className="grid gap-1 border-b border-[#f0f2ee] py-2.5 last:border-0 sm:grid-cols-[8rem_1fr] sm:gap-3"
              >
                <span className="font-semibold text-brand-text">{title}</span>
                <span className="leading-relaxed">{text}</span>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="border-t border-[#edf0ea] bg-[#fbfcfa] px-5 py-4 sm:px-6">
        <button
          onClick={handleAccept}
          disabled={accepted}
          className="w-full rounded-2xl py-3 text-sm font-semibold transition-all"
          style={{
            background: accepted ? '#e8ede5' : '#8fa17f',
            color: accepted ? '#8fa17f' : '#fff',
          }}
        >
          {accepted ? 'Understood' : 'I understand'}
        </button>
      </div>
    </div>
  )
}
