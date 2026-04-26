import { useState } from 'react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  parseISO,
} from 'date-fns'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface DatePickerProps {
  selectedDate: string
  onSelect: (date: string) => void
  isDateBlocked: (date: string) => boolean
  minDate: string
}

export default function DatePicker({ selectedDate, onSelect, isDateBlocked, minDate }: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const handleSelect = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    if (isDateBlocked(dateStr)) return
    if (dateStr < minDate) return
    onSelect(dateStr)
  }

  return (
    <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-brand-border/70 bg-white shadow-[0_10px_30px_rgba(44,44,44,0.04)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#edf0ea] px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8fa17f] text-xs font-semibold text-white">
            2
          </span>
          <div>
            <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8fa17f]">
              Date
            </p>
            <h2 className="text-sm font-semibold text-brand-text">Choose a date</h2>
          </div>
        </div>
        {selectedDate && (
          <button
            onClick={() => onSelect('')}
            className="rounded-full border border-[#dfe6da] px-3 py-1 text-xs font-semibold text-[#7f9670] transition-colors hover:bg-[#f4f7f1]"
          >
            Change
          </button>
        )}
      </div>

      {selectedDate && (
        <div className="bg-[#fbfcfa] px-5 py-4 sm:px-6">
          <div className="rounded-2xl border border-[#cfdcc8] bg-[#f1f6ee] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(143,161,127,0.08)]">
            <span className="mb-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-semibold text-[#7f9670]">
              Selected
            </span>
            <p className="text-sm font-semibold text-brand-text">
              {format(parseISO(selectedDate), 'EEEE, d MMMM')}
            </p>
          </div>
        </div>
      )}

      {!selectedDate && (
        <div className="bg-[#fbfcfa] px-5 py-4 sm:px-6">
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#edf0ea] bg-white px-3 py-2">
            <button
              onClick={prevMonth}
              aria-label="Previous month"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#edf0ea] bg-[#fbfcfa] text-sm font-semibold text-[#7f9670] transition-colors hover:bg-[#eef3ea]"
            >
              {'<'}
            </button>
            <span className="text-sm font-semibold text-brand-text">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button
              onClick={nextMonth}
              aria-label="Next month"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#edf0ea] bg-[#fbfcfa] text-sm font-semibold text-[#7f9670] transition-colors hover:bg-[#eef3ea]"
            >
              {'>'}
            </button>
          </div>

          <div className="rounded-2xl border border-[#edf0ea] bg-white p-3 sm:p-4">
            <div className="mb-2 grid grid-cols-7">
              {DAYS.map((d) => (
                <div
                  key={d}
                  className="py-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-brand-muted"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {days.map((day, i) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const blocked = isDateBlocked(dateStr)
                const past = dateStr < minDate
                const sameMonth = isSameMonth(day, currentMonth)
                const disabled = blocked || past || !sameMonth
                const selected = dateStr === selectedDate
                const dayClass = selected
                  ? 'border-[#8fa17f] bg-[#8fa17f] font-semibold text-white shadow-[0_8px_18px_rgba(143,161,127,0.25)]'
                  : disabled
                    ? sameMonth
                      ? 'border-transparent bg-[#f5f6f3] text-[#aeb4aa]'
                      : 'border-transparent bg-transparent text-[#d2d6ce]'
                    : 'border-[#edf0ea] bg-white font-medium text-brand-text hover:border-[#cfdcc8] hover:bg-[#f1f6ee] hover:text-[#6f875f]'

                return (
                  <button
                    key={i}
                    disabled={disabled}
                    onClick={() => handleSelect(day)}
                    className={`flex aspect-square min-h-10 items-center justify-center rounded-2xl border text-xs transition-all disabled:cursor-not-allowed sm:min-h-11 ${dayClass}`}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
