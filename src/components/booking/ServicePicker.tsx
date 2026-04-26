import { useState } from 'react'
import type { Service } from '../../types'

const CATEGORIES = [
  { label: 'Manicure', keywords: ['gel polish', 'biab', 'acrylic', 'manicure removal', 'soak off'] },
  { label: 'Pedicure', keywords: ['pedicure', 'gel polish on toes'] },
  { label: 'Nail Art', keywords: ['nail art'] },
  { label: 'Waxing', keywords: ['wax'] },
  { label: 'Lashes & Brows', keywords: ['lash', 'brow'] },
  { label: 'Makeup', keywords: ['makeup'] },
  { label: 'Spray Tan', keywords: ['tan'] },
]

function categorise(services: Service[]) {
  const result: { label: string; items: Service[] }[] = []
  const used = new Set<string>()

  for (const cat of CATEGORIES) {
    const matched = services.filter(
      (s) => cat.keywords.some((k) => s.name.toLowerCase().includes(k)) && !used.has(s.id)
    )
    if (matched.length) {
      matched.forEach((s) => used.add(s.id))
      result.push({ label: cat.label, items: matched })
    }
  }

  const rest = services.filter((s) => !used.has(s.id))
  if (rest.length) result.push({ label: 'Other', items: rest })
  return result
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
}

interface ServicePickerProps {
  services: Service[]
  selected: Service | null
  onSelect: (service: Service | null) => void
}

export default function ServicePicker({ services, selected, onSelect }: ServicePickerProps) {
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const categorised = categorise(services)

  return (
    <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-brand-border/70 bg-white shadow-[0_10px_30px_rgba(44,44,44,0.04)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#edf0ea] px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8fa17f] text-xs font-semibold text-white">
            1
          </span>
          <div>
            <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8fa17f]">
              Service
            </p>
            <h2 className="text-sm font-semibold text-brand-text">Choose a service</h2>
          </div>
        </div>
        {selected && (
          <button
            onClick={() => onSelect(null)}
            className="rounded-full border border-[#dfe6da] px-3 py-1 text-xs font-semibold text-[#7f9670] transition-colors hover:bg-[#f4f7f1]"
          >
            Change
          </button>
        )}
      </div>

      {selected && (
        <div className="bg-[#fbfcfa] px-5 py-4 sm:px-6">
          <div className="rounded-2xl border border-[#cfdcc8] bg-[#f1f6ee] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(143,161,127,0.08)]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-semibold text-[#7f9670]">
                Selected
              </span>
              <span className="text-sm font-semibold text-[#6f875f]">
                {formatPrice(selected.price)}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-brand-text">{selected.name}</h3>
            <p className="mt-1 text-xs text-brand-muted">{selected.duration_minutes} min</p>
          </div>
        </div>
      )}

      {!selected && categorised.length === 0 && (
        <p className="px-5 py-5 text-center text-xs text-brand-muted sm:px-6">
          No services are available right now. Please try again later.
        </p>
      )}

      {!selected && categorised.length > 0 && (
        <div className="divide-y divide-[#edf0ea]">
          {categorised.map((cat) => (
            <div key={cat.label}>
              <button
                onClick={() => setOpenCategory(openCategory === cat.label ? null : cat.label)}
                aria-expanded={openCategory === cat.label}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[#fbfcfa] sm:px-6"
              >
                <span>
                  <span className="block text-sm font-semibold text-brand-text">{cat.label}</span>
                  <span className="mt-0.5 block text-[0.72rem] font-medium text-brand-muted">
                    {cat.items.length} {cat.items.length === 1 ? 'service' : 'services'}
                  </span>
                </span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef3ea] text-sm font-semibold text-[#7f9670]">
                  {openCategory === cat.label ? '-' : '+'}
                </span>
              </button>
              {openCategory === cat.label && (
                <div className="grid gap-2 bg-[#fbfcfa] px-5 pb-4 sm:grid-cols-2 sm:px-6">
                  {cat.items.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onSelect(s)}
                      className="group flex min-h-20 w-full flex-col justify-between rounded-2xl border border-[#edf0ea] bg-white px-4 py-3 text-left transition-all hover:border-[#d5e0ce] hover:bg-[#f7faf5] hover:shadow-[0_8px_24px_rgba(44,44,44,0.04)] sm:min-h-24"
                    >
                      <span className="text-sm font-semibold leading-snug text-brand-text">
                        {s.name}
                      </span>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <span className="text-xs font-medium text-brand-muted">
                          {s.duration_minutes} min
                        </span>
                        <span className="text-sm font-semibold text-[#7f9670]">
                          {formatPrice(s.price)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
