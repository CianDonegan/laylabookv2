import type { Service } from '../../types'

interface AddonPickerProps {
  addons: Service[]
  selectedAddons: Service[]
  primaryService: Service | null
  onToggle: (addon: Service) => void
}

export default function AddonPicker({ addons, selectedAddons, primaryService, onToggle }: AddonPickerProps) {
  if (!primaryService || addons.length === 0) return null

  const compatible = addons.filter((a) => {
    if (!a.addon_for_categories || a.addon_for_categories.length === 0) return true
    return a.addon_for_categories.includes(primaryService.category)
  })

  if (compatible.length === 0) return null

  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
      <div className="px-6 pt-5 pb-4 border-b border-brand-border">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium bg-brand-sage">
            +
          </span>
          <h2 className="font-medium text-sm text-brand-text">
            Add-ons <span className="font-normal text-xs ml-1 text-brand-muted">(optional)</span>
          </h2>
        </div>
      </div>
      <div>
        {compatible.map((s) => {
          const selected = selectedAddons.find((a) => a.id === s.id)
          return (
            <button
              key={s.id}
              onClick={() => onToggle(s)}
              className="w-full flex items-center justify-between px-6 py-3 text-left transition-colors border-b border-brand-border last:border-0"
              style={{ background: selected ? '#e8ede5' : 'white' }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-5 h-5 rounded-full border flex items-center justify-center text-xs"
                  style={{
                    border: `1.5px solid ${selected ? '#a8b89a' : '#ebebeb'}`,
                    background: selected ? '#a8b89a' : 'white',
                    color: 'white',
                  }}
                >
                  {selected ? '✓' : ''}
                </span>
                <span className="text-sm text-brand-text">{s.name}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-brand-sage">+€{s.price}</span>
                <span className="text-xs ml-2 text-brand-muted">{s.duration_minutes}min</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}