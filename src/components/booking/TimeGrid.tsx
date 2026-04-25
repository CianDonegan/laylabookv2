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
      <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium bg-brand-sage">
            3
          </span>
          <h2 className="font-medium text-sm text-brand-text">Choose a time</h2>
        </div>
        <p className="mb-4 text-xs text-brand-muted">Checking available appointment times...</p>
        <div className="grid grid-cols-4 gap-2 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 rounded-2xl bg-gray-100" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-brand-border">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium bg-brand-sage">
            3
          </span>
          <h2 className="font-medium text-sm text-brand-text">Choose a time</h2>
        </div>
        {selectedTime && (
          <button onClick={() => onSelect('')} className="text-xs text-brand-muted">
            Change
          </button>
        )}
      </div>

      {selectedTime && (
        <div className="px-6 py-3 text-sm font-medium text-brand-sage">{selectedTime}</div>
      )}

      {!selectedTime && (
        <div className="p-6 grid grid-cols-4 gap-2">
          {error ? (
            <p className="col-span-4 text-center text-xs text-red-500 py-4">
              Could not load times. Please choose the date again or refresh the page.
            </p>
          ) : slots.length === 0 ? (
            <p className="col-span-4 text-center text-xs text-brand-muted py-4">
              No available slots for this date.
            </p>
          ) : (
            slots.map((time) => (
              <button
                key={time}
                onClick={() => onSelect(time)}
                className={`py-2.5 rounded-2xl text-xs transition-all ${
                  selectedTime === time
                    ? 'bg-brand-sage text-white'
                    : 'bg-brand-sage-light text-brand-text hover:bg-[#d5ddd0]'
                }`}
              >
                {time}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
