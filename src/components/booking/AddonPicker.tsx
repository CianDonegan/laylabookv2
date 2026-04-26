import type { Service } from '../../types'

interface AddonPickerProps {
  addons: Service[]
  selectedAddons: Service[]
  primaryService: Service | null
  onToggle: (addon: Service) => void
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
}

export default function AddonPicker({ addons, selectedAddons, primaryService, onToggle }: AddonPickerProps) {
  if (!primaryService || addons.length === 0) return null

  const compatible = addons.filter((a) => {
    if (!a.addon_for_categories || a.addon_for_categories.length === 0) return true
    return a.addon_for_categories.includes(primaryService.category)
  })

  if (compatible.length === 0) return null

  return (
    <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-brand-border/70 bg-white shadow-[0_10px_30px_rgba(44,44,44,0.04)]">
      <div className="border-b border-[#edf0ea] px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8fa17f] text-xs font-semibold text-white">
            +
          </span>
          <div>
            <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8fa17f]">
              Extras
            </p>
            <h2 className="text-sm font-semibold text-brand-text">
              Add-ons <span className="ml-1 text-xs font-medium text-brand-muted">optional</span>
            </h2>
          </div>
        </div>
      </div>
      <div className="grid gap-2 bg-[#fbfcfa] px-5 py-4 sm:grid-cols-2 sm:px-6">
        {compatible.map((s) => {
          const selected = selectedAddons.find((a) => a.id === s.id)
          return (
            <button
              key={s.id}
              onClick={() => onToggle(s)}
              aria-pressed={Boolean(selected)}
              className={`flex min-h-20 w-full flex-col justify-between rounded-2xl border px-4 py-3 text-left transition-all sm:min-h-24 ${
                selected
                  ? 'border-[#cfdcc8] bg-[#f1f6ee] shadow-[inset_0_0_0_1px_rgba(143,161,127,0.08)]'
                  : 'border-[#edf0ea] bg-white hover:border-[#d5e0ce] hover:bg-[#f7faf5] hover:shadow-[0_8px_24px_rgba(44,44,44,0.04)]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold leading-snug text-brand-text">{s.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
                    selected ? 'bg-white text-[#7f9670]' : 'bg-[#eef3ea] text-[#7f9670]'
                  }`}
                >
                  {selected ? 'Added' : 'Add'}
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className="text-xs font-medium text-brand-muted">
                  {s.duration_minutes} min
                </span>
                <span className="text-sm font-semibold text-[#7f9670]">
                  +{formatPrice(s.price)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
