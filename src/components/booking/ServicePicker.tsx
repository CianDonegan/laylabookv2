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

interface ServicePickerProps {
  services: Service[]
  selected: Service | null
  onSelect: (service: Service | null) => void
}

export default function ServicePicker({ services, selected, onSelect }: ServicePickerProps) {
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const categorised = categorise(services)

  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-brand-border">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium bg-brand-sage">
            1
          </span>
          <h2 className="font-medium text-sm text-brand-text">Choose a service</h2>
        </div>
        {selected && (
          <button onClick={() => onSelect(null)} className="text-xs text-brand-muted">
            Change
          </button>
        )}
      </div>

      {selected && (
        <div className="px-6 py-3 text-sm font-medium text-brand-sage">
          {selected.name} - EUR {selected.price}
        </div>
      )}

      {!selected && categorised.length === 0 && (
        <p className="px-6 py-5 text-center text-xs text-brand-muted">
          No services are available right now. Please try again later.
        </p>
      )}

      {!selected && categorised.length > 0 && (
        <div>
          {categorised.map((cat) => (
            <div key={cat.label} className="border-b border-brand-border last:border-0">
              <button
                onClick={() => setOpenCategory(openCategory === cat.label ? null : cat.label)}
                className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-brand-text">{cat.label}</span>
                <span className="text-brand-muted">
                  {openCategory === cat.label ? '-' : '+'}
                </span>
              </button>
              {openCategory === cat.label && (
                <div className="bg-brand-sage-light">
                  {cat.items.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onSelect(s)}
                      className="w-full flex items-center justify-between px-8 py-3 text-left transition-colors hover:bg-green-50"
                    >
                      <span className="text-sm text-brand-text">{s.name}</span>
                      <div>
                        <span className="text-sm font-medium text-brand-sage">EUR {s.price}</span>
                        <span className="text-xs ml-2 text-brand-muted">{s.duration_minutes}min</span>
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
