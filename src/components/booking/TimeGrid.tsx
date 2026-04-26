interface TimeGridProps {
  slots: string[]
  selectedTime: string
  onSelect: (time: string) => void
  loading: boolean
  error: string | null
}

export default function TimeGrid({ slots, selectedTime, onSelect, loading, error }: TimeGridProps) {
  if (loading) {
    return (
      <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-brand-border/70 bg-white shadow-[0_10px_30px_rgba(44,44,44,0.04)]">
        <div className="border-b border-[#edf0ea] px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8fa17f] text-xs font-semibold text-white">
              3
            </span>
            <div>
              <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8fa17f]">
                Time
              </p>
              <h2 className="text-sm font-semibold text-brand-text">Choose a time</h2>
            </div>
          </div>
        </div>
        <div className="bg-[#fbfcfa] px-5 py-4 sm:px-6">
          <div className="rounded-2xl border border-[#edf0ea] bg-white p-4">
            <p className="mb-4 text-xs font-medium text-brand-muted">
              Checking available appointment times...
            </p>
            <div className="grid animate-pulse grid-cols-3 gap-2 sm:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-11 rounded-2xl bg-[#eef3ea]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-brand-border/70 bg-white shadow-[0_10px_30px_rgba(44,44,44,0.04)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#edf0ea] px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8fa17f] text-xs font-semibold text-white">
            3
          </span>
          <div>
            <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8fa17f]">
              Time
            </p>
            <h2 className="text-sm font-semibold text-brand-text">Choose a time</h2>
          </div>
        </div>
        {selectedTime && (
          <button
            onClick={() => onSelect('')}
            className="rounded-full border border-[#dfe6da] px-3 py-1 text-xs font-semibold text-[#7f9670] transition-colors hover:bg-[#f4f7f1]"
          >
            Change
          </button>
        )}
      </div>

      {selectedTime && (
        <div className="bg-[#fbfcfa] px-5 py-4 sm:px-6">
          <div className="rounded-2xl border border-[#cfdcc8] bg-[#f1f6ee] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(143,161,127,0.08)]">
            <span className="mb-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-semibold text-[#7f9670]">
              Selected
            </span>
            <p className="text-sm font-semibold text-brand-text">{selectedTime}</p>
          </div>
        </div>
      )}

      {!selectedTime && (
        <div className="bg-[#fbfcfa] px-5 py-4 sm:px-6">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {error ? (
              <div className="col-span-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-5 text-center sm:col-span-4">
                <p className="text-xs font-medium leading-relaxed text-red-600">
                  Could not load times. Please choose the date again or refresh the page.
                </p>
              </div>
            ) : slots.length === 0 ? (
              <div className="col-span-3 rounded-2xl border border-[#edf0ea] bg-white px-4 py-5 text-center sm:col-span-4">
                <p className="text-sm font-semibold text-brand-text">No times available</p>
                <p className="mt-1 text-xs leading-relaxed text-brand-muted">
                  This date is fully booked. Please choose another date.
                </p>
              </div>
            ) : (
              slots.map((time) => (
                <button
                  key={time}
                  onClick={() => onSelect(time)}
                  className={`min-h-11 rounded-2xl border px-3 py-2.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa17f] focus-visible:ring-offset-2 ${
                    selectedTime === time
                      ? 'border-[#6f875f] bg-[#6f875f] text-white shadow-[0_8px_18px_rgba(111,135,95,0.22)]'
                      : 'border-[#dfe6da] bg-white text-brand-text hover:border-[#cfdcc8] hover:bg-[#f1f6ee] hover:text-[#6f875f] hover:shadow-[0_8px_24px_rgba(44,44,44,0.04)]'
                  }`}
                >
                  {time}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
