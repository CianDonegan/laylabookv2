import { useState } from 'react'

const POLICIES: [string, string][] = [
  ['Payment', 'Cash only. Please bring exact change.'],
  ['Refills', "Refills over other artists' nails or lash work are not offered."],
  ['Punctuality', 'Late arrivals over 10 mins may result in a shortened service or rescheduling.'],
  ['Cancellations', '24 hours notice required for all cancellations.'],
  ['Confirmations', 'A confirmation text will be sent within 24 hours.'],
  ['No-Shows', 'Clients who do not attend without notice will be unable to book future appointments.'],
  ['Patch Testing', 'Required for waxing and tinting services. Please schedule in advance.'],
  ['Media Consent', 'Photos or videos taken may be posted to social media. Let me know if you do not consent.'],
  ['Location', 'Clondalkin, D22.'],
  ['Entry Protocol', 'Text when you arrive outside and I will come to let you in.'],
]

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
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
      <div className="px-6 pt-6 pb-2">
        <h2 className="text-sm font-semibold mb-3 text-brand-text">Booking Policy</h2>
        <p className="text-xs leading-relaxed mb-4 text-brand-muted">
          Thank you for choosing Beauty by Layla. Please read the policies before booking.
        </p>
        <div className="space-y-0 text-xs mb-4 text-brand-muted">
          {POLICIES.map(([title, text]) => (
            <div key={title} className="flex gap-4 py-2.5 border-b border-brand-border">
              <span className="font-semibold shrink-0 w-28 text-brand-text">{title}</span>
              <span className="leading-relaxed">{text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="px-6 pb-6">
        <button
          onClick={handleAccept}
          disabled={accepted}
          className="w-full py-3 rounded-2xl text-sm font-medium transition-all"
          style={{
            background: accepted ? '#e8ede5' : '#a8b89a',
            color: accepted ? '#a8b89a' : '#fff',
          }}
        >
          {accepted ? 'Understood' : 'I understand'}
        </button>
      </div>
    </div>
  )
}
